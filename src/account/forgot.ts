import { $, cooldown, digitsOnly, emailOk, leaveIfSignedIn, run, showMessage } from './ui';
import { forgotPassword, resendCode, resetPassword } from '../shared/sync/api';

leaveIfSignedIn();

let email = '';

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const address = $<HTMLInputElement>('email').value.trim().toLowerCase();
  const error = $('error');
  if (!emailOk(address)) return showMessage(error, 'Enter a valid email address.');
  void run($<HTMLButtonElement>('submit'), error, async () => {
    await forgotPassword(address);
    email = address;
    $('sent-to').textContent = address;
    $('form').hidden = true;
    $('reset').hidden = false;
    $<HTMLInputElement>('code').focus();
    cooldown($<HTMLButtonElement>('resend'), 'Send a new code');
  });
});

digitsOnly($<HTMLInputElement>('code'));

$('reset').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $<HTMLInputElement>('code').value;
  const password = $<HTMLInputElement>('password').value;
  const error = $('reset-error');
  if (code.length !== 6) return showMessage(error, 'Enter the 6-digit code.');
  if (password.length < 8) return showMessage(error, 'Use at least 8 characters for the password.');
  void run($<HTMLButtonElement>('reset-submit'), error, async () => {
    await resetPassword(email, code, password);
    location.href = '/signin/index.html?reset=1';
  });
});

$('resend').addEventListener('click', () => {
  const button = $<HTMLButtonElement>('resend');
  void run(button, $('reset-error'), async () => {
    await resendCode(email, 'reset');
    cooldown(button, 'Send a new code');
  });
});
