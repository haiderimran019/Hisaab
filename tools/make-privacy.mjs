/* Renders docs/PRIVACY.md from the Privacy page the app actually shows.

   docs/PRIVACY.md has always said it was generated from src/ui-privacy.ts "so
   they cannot drift apart". That was an intention, not a mechanism — there was
   no generator, and the two did drift. This is the mechanism.

   Run it after changing the notice:
       npm run privacy

   It renders the version a *configured* build shows, because that is the
   version with the most in it: the usage ping, the mailing list, document
   reading, the portal and the review broker. A build with no service
   configured shows strictly less, and the footer says so.

       node --import tsx tools/make-privacy.mjs [--check]

   --check exits non-zero if the file on disk is out of date, which is what CI
   should run so a notice can never ship behind the code it describes. */
import {writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'docs','PRIVACY.md');

const {privacyNotice}=await import('../src/ui-privacy.ts');

// true = the branch a configured build shows, so the document never
// under-describes a shipped build. See the comment on privacyNotice.
const html=privacyNotice(true);

/** Turns the one section of HTML we generate into Markdown. Deliberately not a
    general HTML converter: it understands exactly the tags the notice uses, and
    throws on anything else rather than quietly dropping it. */
function toMarkdown(html){
 const inner=html.replace(/^\s*<section[^>]*>/,'').replace(/<\/section>\s*$/,'');
 const lines=[];
 const blocks=inner.match(/<(h2|h3|p|ul|ol)\b[\s\S]*?<\/\1>/g)??[];
 const consumed=blocks.join('').length;
 const stripped=inner.length;
 for(const block of blocks){
  const tag=block.match(/^<(\w+)/)[1];
  if(tag==='h2')lines.push(`# ${text(block)}`);
  else if(tag==='h3')lines.push(`## ${text(block)}`);
  else if(tag==='p')lines.push(/class="muted small"/.test(block)?`_${text(block)}_`:text(block));
  else for(const item of block.match(/<li>[\s\S]*?<\/li>/g)??[])lines.push(`- ${text(item)}`);
 }
 // If a future edit introduces a block shape this does not know about, the
 // document would silently lose a paragraph. Refuse instead.
 if(blocks.length<10||consumed<stripped*0.9)
  throw new Error(`the notice does not render fully: ${blocks.length} blocks, `
   +`${consumed} of ${stripped} characters accounted for`);
 return lines;
}

/** Inline HTML to Markdown, refusing rather than guessing at anything unknown. */
function text(block){
 const body=block.replace(/^<\w+[^>]*>/,'').replace(/<\/\w+>$/,'');
 const md=body
  .replace(/<b>([\s\S]*?)<\/b>/g,'**$1**')
  .replace(/<code>([\s\S]*?)<\/code>/g,'`$1`')
  .replace(/<\/?(?:span|em|i)>/g,'');
 if(/<[a-z]/i.test(md))throw new Error(`unhandled markup in the notice: ${md.slice(0,120)}`);
 return md.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}

const rendered=[
 ...toMarkdown(html),
 '',
 '---',
 '',
 'This file and the Privacy page inside the app are generated from the same source'
 +' (`src/ui-privacy.ts`) by `tools/make-privacy.mjs`, so they cannot drift apart —'
 +' run `npm run privacy` after changing the notice, and `npm run privacy:check` in CI.'
 +' It describes the fullest build: one with no Hisaab service configured has no usage'
 +' counting, no sign-up form, no licence portal and no document reading at all, and'
 +' its own Privacy page says so.'
].join('\n')+'\n';

if(process.argv.includes('--check')){
 const existing=readFileSync(out,'utf8');
 if(existing!==rendered){
  console.error('docs/PRIVACY.md is out of date with src/ui-privacy.ts. Run: npm run privacy');
  process.exit(1);
 }
 console.log('docs/PRIVACY.md matches the notice in the app.');
}else{
 writeFileSync(out,rendered);
 console.log(`wrote docs/PRIVACY.md (${rendered.split('\n').length} lines)`);
}
