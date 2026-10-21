/* Privacy, security and the review tick — the surfaces, in plain words.
   Every claim here is one the implementation can actually keep. */
import {escapeHTML as h,type Workspace} from './core';
import {icon} from './format';
import {RECOVERY_COUNT} from './totp';
import type {ReviewStatus} from './review';
import {REVIEWERS} from './review';

export type SecurityCtx={workspace:Workspace;review:ReviewStatus;twoFactorDraft:TwoFactorDraft|null;demo:boolean};
export type TwoFactorDraft={secret:string;uri:string;codes:string[];confirmed:boolean};

export function securityPanel(ctx:SecurityCtx){
 const s=ctx.workspace.security;
 const draft=ctx.twoFactorDraft;
 return `<section class="panel settings-panel">
  <h2>Privacy and security</h2>
  <p>Everything below happens on this device. Hisaab has no server to send any of it to.</p>

  <div class="control-list">
   <div class="control">
    <div><b>Two-factor code on unlock</b>
     <p>Ask for a 6-digit code from an authenticator app as well as your passphrase. Works offline — no phone number, no email address.</p>
     ${s.twoFactor?`<p class="control-state ok">${icon('check')}On · ${RECOVERY_COUNT-s.recoveryUsed} of ${RECOVERY_COUNT} recovery codes unused</p>`:''}</div>
    ${ctx.demo?'<span class="control-note">Create a private workspace to use this</span>'
     :s.twoFactor?`<button class="btn ghost" data-action="disable-2fa">Turn off</button>`
     :`<button class="btn secondary" data-action="setup-2fa">Set up</button>`}
   </div>

   <div class="control">
    <div><b>Lock by itself after</b>
     <p>The workspace locks when you stop touching it, and whenever this tab goes to the background.</p></div>
    <label class="year-picker"><span class="sr-only">Auto-lock</span>
     <select id="autolock" ${ctx.demo?'disabled':''}>
      ${[1,5,15,30].map(m=>`<option value="${m}" ${s.autoLockMinutes===m?'selected':''}>${m} minute${m===1?'':'s'}</option>`).join('')}
     </select>${icon('chevron-down')}</label>
   </div>

   <div class="control">
    <div><b>Never touch the network</b>
     <p>Turns off the optional reference exchange-rate lookup — the only outside request this app can make. With it on, nothing leaves this browser at all, not even your IP address to a rate provider.</p></div>
    <label class="switch"><input type="checkbox" id="offline-only" ${s.offlineOnly?'checked':''} ${ctx.demo?'disabled':''}><span></span></label>
   </div>

   <div class="control">
    <div><b>Hide amounts until I ask</b>
     <p>Blurs figures on Home so you can open this on a bus, in a café, or while sharing your screen.</p></div>
    <label class="switch"><input type="checkbox" id="blur-amounts" ${s.blurAmounts?'checked':''} ${ctx.demo?'disabled':''}><span></span></label>
   </div>

   <div class="control">
    <div><b>Lock right now</b>
     <p>Clears the screen and forgets the key. Use it when you walk away.</p></div>
    <button class="btn ghost" data-action="lock" ${ctx.demo?'disabled':''}>${icon('lock-keyhole')}Lock</button>
   </div>
  </div>

  ${draft?`<div class="twofa-setup">
   <h3>Set up your authenticator</h3>
   <ol class="plain-steps">
    <li>Open Google Authenticator, Aegis, 1Password or any similar app.</li>
    <li>Add an account by typing this key in:
     <code class="secret">${h(draft.secret.replace(/(.{4})/g,'$1 ').trim())}</code>
     <button type="button" class="btn tiny ghost" data-copy="${h(draft.secret)}">${icon('copy')}Copy key</button>
     <a class="text-link" href="${h(draft.uri)}">or open it in your app ${icon('external-link')}</a></li>
    <li>Save these recovery codes somewhere safe. <b>They are shown once.</b> Each one opens your workspace a single time if you lose your phone.
     <ul class="recovery-codes">${draft.codes.map(c=>`<li>${h(c)}</li>`).join('')}</ul>
     <button type="button" class="btn tiny ghost" data-copy="${h(draft.codes.join('\n'))}">${icon('copy')}Copy codes</button></li>
    <li>Type the 6-digit code your app is showing now, to prove it works:
     <form id="twofa-form" class="inline-form">
      <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label="Six-digit code">
      <button type="submit" class="btn primary">${icon('shield-check')}Turn on</button>
     </form>
     <p class="form-error"></p></li>
   </ol>
   <p class="muted small"><b>What this does and does not do.</b> It stops someone who knows or has watched your passphrase from opening the workspace. It does not make the encryption stronger: the shared secret sits inside the encrypted workspace, so it can only be checked once your passphrase has already unlocked it. Your passphrase is still the thing that protects your records.</p>
  </div>`:''}
 </section>

 <section class="panel settings-panel">
  <h2>Practitioner review</h2>
  ${reviewBody(ctx)}
 </section>`;
}

function reviewBody(ctx:SecurityCtx){
 const r=ctx.review;
 if(!REVIEWERS.length)return `<p>No reviewing practitioner is published with this release, so no review tick can be shown yet — not even by us. When a qualified Pakistani practitioner is engaged, their signing key ships with an update and their certificates start verifying here.</p>
  <p class="muted small">This is deliberate. A tick that the publisher can mint for itself is worth nothing.</p>`;
 const state=r.state;
 return `${state==='verified'?`<p class="plan-state ok">${icon('shield-check')}Reviewed by ${h(r.payload.name)} (${h(r.payload.registration)}) on ${h(r.payload.reviewedOn)}</p>`
  :state==='stale'?`<p class="plan-state warn">${icon('octagon-alert')}${h(r.reason)}</p>`
  :state==='invalid'?`<p class="plan-state bad">${icon('octagon-alert')}${h(r.reason)}</p>`
  :`<p>Send your Filing Pack to a reviewing practitioner. They return a certificate you paste here, and your pack carries a verified tick.</p>`}
  <form id="review-form" class="form-grid">
   <label class="field"><span>Review certificate</span>
    <input name="certificate" type="text" placeholder="HSBREV1.…" value="${h(ctx.workspace.review.certificate)}" autocomplete="off" spellcheck="false"></label>
   <div class="drawer-actions"><button type="submit" class="btn primary">${icon('shield-check')}Check certificate</button>
   ${ctx.workspace.review.certificate?`<button type="button" class="btn ghost" data-action="remove-review">${icon('trash-2')}Remove</button>`:''}</div>
   <p class="form-error"></p>
  </form>
  <p class="muted small">The certificate is tied to your pack's fingerprint. Change any figure afterwards and the tick turns amber by itself — it will not quietly cover numbers nobody checked. A tick means the holder of that reviewing key signed off these figures. It is not FBR approval and Hisaab does not verify the reviewer's registration itself.</p>`;
}

export function privacyNotice(){
 return `<section class="panel prose-panel">
  <h2>Privacy notice</h2>
  <p class="muted small">Last updated 21 October 2026. Written to be read, not to protect us.</p>

  <h3>The short version</h3>
  <p>Hisaab runs entirely in your browser. There is no account, no server holding your books, and no database we could hand over, lose or sell. We cannot see your income, your clients, your statements or your passphrase, because they never leave your device.</p>

  <h3>What is stored, and where</h3>
  <ul>
   <li><b>On your device only:</b> your receipts, invoices, expenses, bank accounts, imported statement lines, attached receipt images, tax declarations, licence key and security settings. All of it is encrypted with a key derived from your passphrase and kept in this browser's local storage.</li>
   <li><b>Nowhere else:</b> there is no copy on any server of ours. Backups exist only where you save them.</li>
  </ul>

  <h3>The only outside request this app can make</h3>
  <p>If you press the reference exchange-rate button, your browser asks <code>open.er-api.com</code> for published rates. No financial data is sent — but like any web request, the provider necessarily sees your IP address and the time you asked. Turn on <b>Never touch the network</b> in Privacy and security and even that cannot happen.</p>
  <p>Fonts and icons are served from the app itself. There are no analytics, no trackers, no advertising pixels, no cookies and no third-party scripts of any kind.</p>

  <h3>What we know about paying customers</h3>
  <p>If you buy a licence, we learn what you tell us when you pay: the name to put on the key, and whatever your payment method shows us. We keep that in our own sales ledger so we can honour renewals and refunds. The app never phones home to check your key — it is verified offline against a signature — so we cannot tell whether, when or how you use it.</p>

  <h3>What you are responsible for</h3>
  <ul>
   <li><b>Your passphrase.</b> There is no reset and no recovery service. If you lose it, your workspace cannot be opened by us or by anyone.</li>
   <li><b>Your backups.</b> Clearing your browser data deletes the workspace. Export an encrypted backup and keep it somewhere safe.</li>
   <li><b>What you export.</b> CSV files, worksheets and the Filing Pack are ordinary unencrypted files. Treat them like bank statements.</li>
  </ul>

  <h3>What encryption cannot do</h3>
  <p>It protects your records at rest. It cannot protect an unlocked screen, a device with malware, or a browser extension with permission to read pages. Lock the workspace when you step away, and do not enter bank or IRIS passwords into any field here — Hisaab never asks for them and has no use for them.</p>

  <h3>Your rights</h3>
  <p>Because your data is only ever on your device: you can export all of it at any time, you can delete all of it at any time, and there is no request to make of us. We hold nothing to give you and nothing to erase, apart from the sales ledger entry for a purchase.</p>

  <h3>Children</h3>
  <p>This is a bookkeeping tool for working adults. It is not designed for or directed at children.</p>

  <h3>Changes</h3>
  <p>If this notice changes in a way that affects you, the new version ships with an app update and this date changes. Because we hold no contact details, we cannot email you about it.</p>

  <h3>Contact</h3>
  <p>Through the repository owner's GitHub contact. Please do not include passphrases, real statements or financial data in any message.</p>
 </section>`;
}
