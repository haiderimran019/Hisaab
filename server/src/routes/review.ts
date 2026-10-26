/* The practitioner review broker — and the reason it can exist at all.

   COMMERCIAL.md §7 puts "a qualified Pakistani practitioner's written review" as
   the largest outstanding risk in the product, and src/review.ts already builds
   the hard half: a signed review that goes stale the moment any figure changes.
   What was missing was a way to reach a practitioner.

   The design constraint is absolute: **a Filing Pack never touches this
   service.** A customer sends their pack to the practitioner directly, however
   the two of them agree. All this broker holds is the job — who asked whom, for
   which tax year, and the pack's fingerprint, which is a SHA-256 hash and cannot
   be turned back into figures. The practitioner's signature comes back through
   here, and the app verifies it against their published key.

   So a paid review exists, and this service still holds nobody's books.

   Practitioners sign in through the same portal as customers; a session whose
   email matches a reviewer's contact address is treated as that reviewer. */
import {readReviewRequest,readReviewUpdate,randomToken} from '../validate';
import {json,fail,readJson} from '../http';
import type {Route,Ctx} from '../routes';

/** Public view of a reviewer: enough to choose one, not enough to spam them.
    The contact address is released to a customer once a job exists. */
const publicReviewer=(r:{id:string;name:string;firm:string;registration:string;publicKey:string})=>({
 id:r.id,name:r.name,firm:r.firm,registration:r.registration,publicKey:r.publicKey});

const reviewerForSession=async ({store,session}:Ctx)=>{
 const active=await store.listReviewers('active');
 return active.find(r=>r.contactEmail===session!.email)??null;
};

export const listReviewers:Route={
 method:'GET',path:'/v1/reviewers',auth:'public',
 async handle({store,origin}){
  const active=await store.listReviewers('active');
  return json({reviewers:active.map(publicReviewer),
   note:'Hisaab does not employ these practitioners and does not review their work. Their registration number is shown so you can check it with their own body. You send your Filing Pack to them directly — it never passes through this service.'},200,origin);
 }
};

export const requestReview:Route={
 method:'POST',path:'/v1/review/request',auth:'session',
 limit:{bucket:'q',perDay:10},
 async handle({request,store,origin,session,now}){
  const body=readReviewRequest(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const reviewer=await store.findReviewer(body.value.reviewerId);
  if(!reviewer||reviewer.status!=='active')
   return json({error:'That reviewer is not taking work. Choose another from the list.'},404,origin);
  const id=crypto.randomUUID();
  await store.addReviewJob({id,reviewerId:reviewer.id,customerEmail:session!.email,
   fingerprint:body.value.fingerprint,taxYear:body.value.taxYear,
   status:'requested',signature:'',createdAt:now,updatedAt:now});
  return json({ok:true,jobId:id,
   reviewer:{name:reviewer.name,firm:reviewer.firm,contactEmail:reviewer.contactEmail},
   next:`Send your Filing Pack to ${reviewer.contactEmail} and quote this job id. The pack does not go through Hisaab — only the fingerprint above, so the signed review can be matched to the exact pack you sent.`
  },201,origin);
 }
};

export const myJobs:Route={
 method:'GET',path:'/v1/review/jobs',auth:'session',
 async handle({store,origin,session}){
  const jobs=await store.jobsForCustomer(session!.email,50);
  // Attach the reviewer's name so a customer sees who they asked, not a uuid.
  const active=await store.listReviewers('active');
  const named=jobs.map(j=>({...j,
   reviewerName:active.find(r=>r.id===j.reviewerId)?.name??'(no longer listed)'}));
  return json({jobs:named},200,origin);
 }
};

export const reviewQueue:Route={
 method:'GET',path:'/v1/review/queue',auth:'session',
 async handle(ctx){
  const reviewer=await reviewerForSession(ctx);
  if(!reviewer)return json({error:'This address is not a listed reviewer.'},403,ctx.origin);
  const jobs=await ctx.store.jobsForReviewer(reviewer.id,100);
  return json({reviewer:publicReviewer(reviewer),jobs},200,ctx.origin);
 }
};

export const updateJob:Route={
 method:'POST',path:'/v1/review/update',auth:'session',
 limit:{bucket:'w',perDay:200},
 async handle(ctx){
  const {store,origin,now}=ctx;
  const body=readReviewUpdate(await readJson(ctx.request));
  if(!body.ok)return fail(body,origin);
  const reviewer=await reviewerForSession(ctx);
  if(!reviewer)return json({error:'This address is not a listed reviewer.'},403,origin);
  const job=await store.findReviewJob(body.value.jobId);
  // Same answer for "no such job" and "not your job": a reviewer should not be
  // able to probe for the existence of another reviewer's work.
  if(!job||job.reviewerId!==reviewer.id)
   return json({error:'That is not a review job assigned to you.'},404,origin);
  if(job.status==='signed'||job.status==='withdrawn')
   return json({error:`That job is already ${job.status} and cannot be changed.`},409,origin);
  await store.updateReviewJob(job.id,
   {status:body.value.status,signature:body.value.signature||undefined},now);
  return json({ok:true,jobId:job.id,status:body.value.status},200,origin);
 }
};

export const reviewRoutes=[listReviewers,requestReview,myJobs,reviewQueue,updateJob];
