import { $, finishSignIn, leaveIfSignedIn, param, run, showMessage, emailOk } from './ui';
import { signIn } from '../shared/sync/api';
import { ApiError } from '../shared/sync/api';

leaveIfSignedIn();

if (param('reset')) showMessage($('notice'), 'Password changed. Sign in with your new password.');

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>('email').value.trim();
  const password = $<HTMLInputElement>('password').value;
  const error = $('error');
  if (!emailOk(email)) return showMessage(error, 'Enter a valid email address.');
  if (!password) return showMessage(error, 'Enter your password.');
  void run($<HTMLButtonElement>('submit'), error, async () => {
    try {
      await signIn(email, password);
      finishSignIn();
    } catch (err) {
      // The email was never verified: carry on at the code step (a fresh code was just sent).
      if (err instanceof ApiError && err.code === 'email_not_verified') {
        location.href = `/signup/index.html?verify=${encodeURIComponent(email)}`;
        return;
      }
      throw err;
    }
  });
});
