import { $, cooldown, digitsOnly, emailOk, finishSignIn, leaveIfSignedIn, param, run, showMessage } from './ui';
import { resendCode, signUp, verifyEmail } from '../shared/sync/api';

leaveIfSignedIn();

let email = '';

function toVerify(address: string) {
  email = address;
  $('sent-to').textContent = address;
  $('form').hidden = true;
  $('signin-link').hidden = true;
  $('verify').hidden = false;
  $('page-title').textContent = 'Check your email';
  $<HTMLInputElement>('code').focus();
  cooldown($<HTMLButtonElement>('resend'), 'Send a new code');
}

// Coming from sign in with an unverified account: a code was just emailed.
const pending = param('verify');
if (pending && emailOk(pending)) toVerify(pending);

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const address = $<HTMLInputElement>('email').value.trim().toLowerCase();
  const password = $<HTMLInputElement>('password').value;
  const error = $('error');
  if (!emailOk(address)) return showMessage(error, 'Enter a valid email address.');
  if (password.length < 8) return showMessage(error, 'Use at least 8 characters for the password.');
  void run($<HTMLButtonElement>('submit'), error, async () => {
    await signUp(address, password, $<HTMLInputElement>('name').value.trim());
    toVerify(address);
  });
});

digitsOnly($<HTMLInputElement>('code'));

$('verify').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $<HTMLInputElement>('code').value;
  const error = $('verify-error');
  if (code.length !== 6) return showMessage(error, 'Enter the 6-digit code.');
  void run($<HTMLButtonElement>('verify-submit'), error, async () => {
    await verifyEmail(email, code);
    finishSignIn();
  });
});

$('resend').addEventListener('click', () => {
  const button = $<HTMLButtonElement>('resend');
  void run(button, $('verify-error'), async () => {
    await resendCode(email, 'verify');
    showMessage($('verify-error'), null);
    cooldown(button, 'Send a new code');
  });
});
