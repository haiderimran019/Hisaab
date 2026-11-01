/* Privacy, security and the review tick — the surfaces, in plain words.
   Every claim here is one the implementation can actually keep. */
import {escapeHTML as h,type Workspace} from './core';
import {icon} from './format';
import {RECOVERY_COUNT} from './totp';
import type {ReviewStatus} from './review';
import {REVIEWERS} from './review';
import {serviceConfigured,pingEnabled} from './service';
import {storedTheme,THEMES} from './theme';

export type SecurityCtx={workspace:Workspace;review:ReviewStatus;twoFactorDraft:TwoFactorDraft|null;demo:boolean;
 /** The passkeys registered against this workspace's encryption key. Read from
     the envelope, not from the records: these are unlock slots, not settings. */
 passkeys:{credentialId:string;label:string;addedOn:string}[];
 /** Whether this device has a platform authenticator at all. False hides the
     control rather than offering something that will fail. */
 passkeyCapable:boolean};
export type TwoFactorDraft={secret:string;uri:string;codes:string[];confirmed:boolean};

export function securityPanel(ctx:SecurityCtx){
 const s=ctx.workspace.security;
 const draft=ctx.twoFactorDraft;
 return `<section class="panel settings-panel">
  <h2>Privacy and security</h2>
  <p>Everything below happens on this device.</p>
  <ul class="trust-list">
   <li>${icon('shield-check')}<span><b>Your ledger is encrypted.</b> Optional sync uploads an encrypted envelope. Account and membership metadata are separate; the passphrase stays on your device.</span></li>
   <li>${icon('lock-keyhole')}<span><b>An optional account, a separate unlock.</b> Google sign-in controls cloud access. Your workspace passphrase decrypts your books; it is not sent to the account service.</span></li>
   <li>${icon('circle-help')}<span><b>Nothing is reported to anyone.</b> Hisaab is not connected to FBR, your bank, or any payment provider, and it never files or pays anything on your behalf.</span></li>
   <li>${icon('check')}<span><b>Everything that touches the internet is off until you switch it on</b>, and each one is listed below.</span></li>
  </ul>

  <div class="control-list">
   <div class="control">
    <div><b>Two-factor code on unlock</b>
     <p>Ask for a 6-digit code from an authenticator app as well as your passphrase. Works offline — no phone number, no email address.</p>
     ${s.twoFactor?`<p class="control-state ok">${icon('check')}On · ${RECOVERY_COUNT-s.recoveryUsed} of ${RECOVERY_COUNT} recovery codes unused</p>`:''}</div>
    ${ctx.demo?'<span class="control-note">Create a private workspace to use this</span>'
     :s.twoFactor?`<button class="btn ghost" data-action="disable-2fa">Turn off</button>`
     :`<button class="btn secondary" data-action="setup-2fa">Set up</button>`}
   </div>

   ${ctx.passkeyCapable?`<div class="control">
    <div><b>Unlock with Face ID, Touch ID or Windows Hello</b>
     <p>Registers a passkey on this device that opens the workspace without typing your passphrase. The key is held in this device's secure hardware and never leaves it — Hisaab has no account for it to sign in to.</p>
     ${ctx.passkeys.length?`<ul class="passkey-list">${ctx.passkeys.map(k=>`<li><span>${icon('lock-keyhole')}${h(k.label)} <span class="muted small">added ${h(k.addedOn.slice(0,10))}</span></span><button class="btn tiny ghost" data-remove-passkey="${h(k.credentialId)}">Remove</button></li>`).join('')}</ul>`:''}
     <p class="muted small"><b>Your passphrase always still works, and cannot be removed.</b> A passkey lives in one device. If it were the only way in, a dropped phone would destroy the only copy of your books — so this is a faster door, not a replacement lock. Keep your passphrase written down somewhere safe.</p></div>
    ${ctx.demo?'<span class="control-note">Create a private workspace to use this</span>'
     :`<button class="btn secondary" data-action="add-passkey">${icon('shield-check')}${ctx.passkeys.length?'Add another':'Register'}</button>`}
   </div>`:''}

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
     <p>First revokes this device’s reminder subscription when possible, then blocks optional cloud, reference-rate, local-service and model-download requests. Loaded on-device AI can still run locally. Website navigation and browser-managed infrastructure are separate.</p></div>
    <label class="switch"><input type="checkbox" id="offline-only" ${s.offlineOnly?'checked':''} ${ctx.demo?'disabled':''}><span></span></label>
   </div>

   <div class="control">
    <div><b>Hide amounts until I ask</b>
     <p>Blurs figures on Home so you can open this on a bus, in a café, or while sharing your screen.</p></div>
    <label class="switch"><input type="checkbox" id="blur-amounts" ${s.blurAmounts?'checked':''} ${ctx.demo?'disabled':''}><span></span></label>
   </div>

   ${serviceConfigured()?`<div class="control">
    <div><b>Count this installation</b> <span class="opt-tag">off unless you turn it on</span>
     <p>Once a day, Hisaab would say that it was opened, which build it is, and whether it has a licence — and nothing else. No identifier of any kind is sent, so we could see a trend, never a person. It is off by default and we would rather undercount than take a number from you without asking. Nothing in the app changes either way.</p></div>
    <label class="switch"><input type="checkbox" id="usage-ping" ${pingEnabled()?'checked':''}><span></span></label>
   </div>`:''}

   <div class="control">
    <div><b>Appearance</b>
     <p>Light reads better in daylight, which is where most people do this. Dark follows your device unless you pick one.</p></div>
    <label class="year-picker"><span class="sr-only">Appearance</span>
     <select id="theme">${THEMES.map(([value,label])=>`<option value="${value}" ${storedTheme()===value?'selected':''}>${h(label)}</option>`).join('')}</select>${icon('chevron-down')}</label>
   </div>

   <div class="control">
    <div><b>Read the privacy notice</b>
     <p>What is stored, what leaves this device, and what we could never see even if asked.</p></div>
    <button class="btn ghost" data-page="Privacy">${icon('shield-check')}Open</button>
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

/** `configured` defaults to this build's own answer, so the app always shows
    the truth about itself. tools/make-privacy.mjs passes true, because the
    written notice should describe the fullest build rather than the quietest. */
export function privacyNotice(configured=serviceConfigured()){
 return `<section class="panel prose-panel"><h2>Privacy and data use</h2><p class="muted small">Updated 1 November 2026.</p>
 <h3>Your books and your account</h3><p>Guided bookkeeping works locally without an account. A random key encrypts income, expenses, invoices, statement lines, attached evidence, chats, memory, proposals and file snapshots. Your passphrase protects that key and is never sent to Supabase, Google or an AI provider. The unsaved demo lives in memory.</p>
 <p>If you connect an account, Supabase holds your sign-in identity, company names and membership roles. If you choose Sync, it also holds an encrypted workspace envelope, its revision and update time. Owner and Editor roles can save within their company; Viewers can read its encrypted copy. The encrypted company workspace includes its chats and memory, so members who have its passphrase can read those too. Keep personal notes outside a shared company workspace. Membership alone does not decrypt books. Each new device still needs the workspace passphrase. Device passkey slots are removed from the cloud envelope.</p>
 <p>Company access is enforced by database row-level security and membership tables. User-editable profile metadata cannot grant a company role. Conflicting revisions are refused. Loading a cloud copy replaces local books only after your confirmation and passphrase; keep an encrypted backup of unsynced work first. After a successful connection and sync, changes sync while the workspace stays connected and unlocked. Locking pauses cloud work and clears decrypted state.</p>
 <h3>AI and your choices</h3><p>Guided analysis and financial calculations use deterministic application functions. Optional on-device Qwen runs in a worker after a deliberate large download from Hugging Face and GitHub. Those hosts see your IP address, never your chats. The local development gateway can receive the current request and up to six shortened messages on localhost; it is not a public AI host.</p>
 <p>The optional hosted assistant is reached through Supabase. Before each request, Hisaab shows the exact redacted current message and up to six recent chat messages, the model and its gateway recipient. Known client names, account references, emails and long identity/account numbers are redacted automatically. Redaction can miss details: check the preview. Only your Send tap transmits it. The company ID and sign-in token authenticate the gateway; they are not sent to the model. A ledger snapshot, attachment, passphrase or confirmed memory is not included.</p>
 <p>The configured hosted route uses OpenRouter and its serving model provider, requests no data collection and zero data retention, and refuses paid model IDs. If an eligible free provider or quota is unavailable, guided tools remain available. Hisaab's gateway code does not store prompts or replies on the server; hosting and provider services process request metadata. Review the named provider's terms before sending confidential information. Private chats are not used for automatic shared-model training.</p>
 <p>Hosted chat explains finance, economics, accounting and personal finance. It cannot save records, perform transactions, file returns or supply authoritative tax numbers. Record changes require your confirmed proposal. Tax calculations and IRIS answers use the checked rule register. User-given codes stay labelled From you, not verified and can be removed in What I remember.</p>
 <h3>Reminders and notifications</h3><p>If you enable background reminders, Supabase stores a browser push endpoint, delivery keys, your user/company IDs, selected tax year and reminder preferences. A private scheduled sender uses your browser vendor's push service. These capability URLs and keys are protected by row-level security and are not exposed to other users or companies.</p>
 <p>Lock-screen reminders contain generic check-ins, never client names, balances or tax amounts. Your operating system controls their font and popup layout. You can turn them off in Account settings; signing out removes this account's subscription on this device. Selecting Never touch the network first attempts to revoke this device's reminder subscription, then blocks future app cloud requests. Other devices keep their own notification preferences. Calendar-file reminders are an alternative and are controlled by your calendar app.</p>
 <h3>Other network requests</h3><ul><li>Google sign-in, when configured and chosen, shares identity/profile information with Google and Supabase. It requests no Gmail or bank access.</li><li>Supabase account, company, sync and assistant availability requests start when you choose Connect in Settings. Authentication tokens and non-financial sync-binding metadata are kept in this tab's session storage; decrypted records and memory are not.</li><li>Reference exchange rates are fetched from open.er-api.com only when requested. The provider sees your IP address, not your ledger.</li><li>Fonts, icons and app code are served by the website. Offline app caches contain public assets, never financial records. First-time model/export downloads need a connection.</li></ul>
 ${configured?'<p>The optional legacy Worker can separately handle consented usage pings, email subscriptions or document transcription when explicitly configured. It rejects customer ledger fields. A document-reading screen must name its recipient and request your consent before sending a chosen document.</p>':''}
 <p>Never touch the network blocks optional application requests and model downloads. Loading or updating the website itself and browser-managed push infrastructure are not network-isolation mechanisms. Already-loaded on-device inference can continue locally.</p>
 <h3>Retention, deletion and limits</h3><p>Local books remain until you delete browser data or the workspace. Exported files remain wherever you save or share them and contain plaintext financial data. Deleting a local workspace does not delete an existing cloud copy. Company/account deletion and member-management workflows require owner administration; the app does not yet offer self-service deletion of cloud companies. Ask the owner to remove a cloud copy and revoke access, and retain your own encrypted backup first.</p>
 <p>Supabase retains the current encrypted workspace copy, account and membership records while configured. Reminder preferences last until revoked; expired push endpoints are removed. Quota records hold counts and a rate-window time, not conversation text. Google, Supabase, browser vendors and the selected AI provider each process their part under their own policies.</p>
 <p>Hisaab is not connected to FBR or your bank, cannot submit a return or move money, and does not guarantee tax eligibility or complete current-law coverage. Review estimates with a qualified practitioner. Encryption cannot protect an unlocked or compromised device, and Hisaab cannot reset a forgotten workspace passphrase.</p></section>`;
}
