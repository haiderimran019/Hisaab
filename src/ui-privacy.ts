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
   <li>${icon('shield-check')}<span><b>We cannot see your money.</b> Your income, clients, invoices, expenses and statements are encrypted here and never sent anywhere. There is no server that would accept them even if the app tried.</span></li>
   <li>${icon('lock-keyhole')}<span><b>No account, no sign-up, no password of ours.</b> You do not hand us an identity to lose.</span></li>
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
     <p>Turns off the optional reference exchange-rate lookup — the only outside request this app can make. With it on, nothing leaves this browser at all, not even your IP address to a rate provider.</p></div>
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
 return `<section class="panel prose-panel">
  <h2>Privacy notice</h2>
  <p class="muted small">Last updated 27 October 2026. Written to be read, not to protect us.</p>

  <h3>The short version</h3>
  <p>Your encrypted workspace runs in your browser. There is no server holding your books and no database of anybody's financial records that we could hand over, lose or sell. We cannot read your workspace or your passphrase. A document you deliberately send to a reader is the exception described below.</p>
  <p>If you buy a licence, that purchase is separate, with its own small record — a name, an email address, what you paid and a key — described below. The encrypted workspace and the buyer record never meet: the service holds no customer financial records.</p>

  <h3>What is stored, and where</h3>
  <ul>
   <li><b>On your device only:</b> your receipts, invoices, expenses, bank accounts, imported statement lines, attached receipt images, tax declarations, licence key and security settings. A random key encrypts the workspace; your passphrase protects that key. The encrypted result stays in this browser's local storage.</li>
   <li><b>Nowhere else:</b> there is no copy on any server of ours. Backups exist only where you save them.</li>
  </ul>

  <h3>Every outside request this app can make</h3>
  <p>${configured?'There are four, and that is the complete list for this app. The optional Worker also has portal and review APIs, but this app has no screen that calls them.':'There is one, and that is the complete list.'}</p>
  <ol>
   <li><b>Reference exchange rates</b>, only when you press the button for them: your browser asks <code>open.er-api.com</code> for published rates. No financial data is sent, but like any web request the provider necessarily sees your IP address and the time you asked. <b>Never touch the network</b> in Privacy and security stops even this.</li>
   ${configured?`<li><b>A usage ping</b>, once a day, <b>only if you switch it on</b> — it is off until you do. It carries the date, which build you are running, and whether a licence is active. <b>No identifier of any kind is sent</b>, so we can count how often Hisaab is opened but can never tell one person from another, or link two days together.</li>
   <li><b>Your email address</b>, only if you type it into the key form and press the button. It is used to send your licence key, filing-deadline reminders and occasional product news. We never sell it, one click unsubscribes, and it is never connected to anything financial because we hold nothing financial. You do not need to give one at all — a key can reach you any way you like.</li>
   <li><b>A statement you choose to have read</b>, only when you pick a PDF or photo and confirm the warning on that screen. The file and your licence key go to the reading service named in the dialog. The file is used to transcribe proposed rows and is not stored by us; a per-licence counter records the request. You check and confirm the returned rows. Everything about this is off unless you start it, and CSV import never involves it.</li>`:''}
  </ol>
  <p>Fonts and icons are served from the app itself. There are no trackers, no advertising pixels, no cookies and no third-party scripts of any kind.${configured?'':' This build has no usage counting and no sign-up form, because no Hisaab service is configured in it.'}</p>
  <p><b>What never leaves, under any setting:</b> your income records, clients, invoices, expenses, bank accounts, statement lines, tax figures and passphrase. There is no endpoint that accepts them — the service refuses any request carrying such a field, and there is a test that fires realistic ones at it to prove it. The one exception you can create yourself is a document you deliberately send to be read, and that screen says so before anything moves.</p>
  <p><b>Hisaab is not connected to FBR, to your bank, or to any payment provider.</b> It cannot file a return, pay a tax, move money, or tell anyone anything about you. It is a private notebook that does arithmetic.</p>

  <h3>What we hold about paying customers</h3>
  <p>If you buy a licence, we learn what you tell us when you pay: the name to put on the key, the email address to send it to, and whatever your payment method shows us. We keep that in our own sales ledger — name, email, plan, what you paid, the date and the expiry — so we can honour renewals and refunds. Alongside it we may hold a portal sign-in session, and a review job if you asked for one.</p>
  <p>Normal app use verifies your key on your device against a signature, so it keeps working offline. If you choose optional document reading, that request sends the key to the Worker for entitlement and quota checks.</p>
  <p><b>With one exception, which we would rather state than let you discover.</b> If you request optional document reading, we count the request against its annual allowance before contacting the reader. We keep a single number per licence per tax year: how many requests it made. That number tells us a licence was used and roughly how often — not what was in any document, not when, and nothing about your figures. It is the only record of use that exists, and if you never request a document read, it never exists for you.</p>
  <p><b>Filing reminders, if you confirmed an address.</b> Before a statutory deadline the service emails the date. To avoid sending it twice it records one row per address per deadline: your address, the tax year and which reminder it was. There is no figure in that row and none in the message, because the service has never seen one — it does not know whether you have filed, what you earned, or whether an obligation applies to you, and the email says so. Only deadlines every filer has are ever emailed. Unsubscribing stops them, and erasure deletes those rows with the rest.</p>
  <p>Two things this means in practice, and they cut both ways. We cannot revoke a key, because nothing we hold can reach your device — a refund returns your money and marks our ledger, and your software keeps working. And we cannot restore your workspace, because we have never had a copy of it.</p>

  <h3>What you are responsible for</h3>
  <ul>
   <li><b>Your passphrase.</b> There is no reset or recovery service. Keep it: a backup opened on another device needs the passphrase, even if a passkey was registered on the original device.</li>
   <li><b>Your backups.</b> Clearing your browser data deletes the workspace. Export an encrypted backup and keep it somewhere safe.</li>
   <li><b>What you export.</b> CSV files, worksheets and the Filing Pack are ordinary unencrypted files. Treat them like bank statements.</li>
  </ul>

  <h3>What encryption cannot do</h3>
  <p>It protects your records at rest. It cannot protect an unlocked screen, a device with malware, or a browser extension with permission to read pages. Lock the workspace when you step away, and do not enter bank or IRIS passwords into any field here — Hisaab never asks for them and has no use for them.</p>

  <h3>Your rights</h3>
  <p><b>Your books.</b> They are only ever on your device, so you can export all of them at any time and delete all of them at any time. There is no request to make of us, because we have nothing to give you and nothing to erase.</p>
  <p><b>Everything else.</b> The optional service can hold your mailing-list address, sales ledger entry and review jobs. Its deletion endpoint removes those records after a confirmed request, retaining only a keyed hash of the address to record that erasure happened. This app does not yet offer a deletion button; contact the repository owner if the service is deployed and you want those records removed. One click on an email also unsubscribes you without signing in.</p>

  <h3>Children</h3>
  <p>This is a bookkeeping tool for working adults. It is not designed for or directed at children.</p>

  <h3>Changes</h3>
  <p>If this notice changes in a way that affects you, the new version ships with an app update and this date changes. We can email you only if you separately gave us an address.</p>

  <h3>Contact</h3>
  <p>Through the repository owner's GitHub contact. Please do not include passphrases, real statements or financial data in any message.</p>
 </section>`;
}
