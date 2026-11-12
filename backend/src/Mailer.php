<?php
declare(strict_types=1);

/**
 * Sends the plain emails this API needs. No libraries: a small SMTP client (SSL on 465 or STARTTLS on 587),
 * PHP's mail(), or a log file for local testing. Picked by config 'mail.driver'.
 */
final class Mailer
{
    public static function send(string $to, string $subject, string $text, string $html): void
    {
        $driver = (string) Config::get('mail.driver', 'smtp');
        $from = (string) Config::get('mail.from');
        $fromName = (string) Config::get('mail.from_name', 'Games');
        $boundary = 'b' . bin2hex(random_bytes(12));

        $headers = [
            'Date: ' . date('r'),
            'From: ' . self::encodeHeader($fromName) . ' <' . $from . '>',
            'To: <' . $to . '>',
            'Subject: ' . self::encodeHeader($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (substr(strrchr($from, '@') ?: '@localhost', 1)) . '>',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . "\r\n"
            . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . "\r\n"
            . "--$boundary--\r\n";

        if ($driver === 'log') {
            @file_put_contents(dirname(__DIR__) . '/storage/mail.log', "=== " . date('c') . " to $to\nSubject: $subject\n$text\n\n", FILE_APPEND);
            return;
        }
        if ($driver === 'mail') {
            // mail() adds To and Subject itself, so pass only the other headers.
            $h = implode("\r\n", [$headers[0], $headers[1], $headers[4], $headers[5], $headers[6]]);
            if (!mail($to, self::encodeHeader($subject), $body, $h, '-f' . $from)) throw new RuntimeException('mail() failed');
            return;
        }
        self::smtp($to, $from, implode("\r\n", $headers) . "\r\n\r\n" . $body);
    }

    private static function encodeHeader(string $s): string
    {
        return preg_match('/^[\x20-\x7e]*$/', $s) ? $s : '=?UTF-8?B?' . base64_encode($s) . '?=';
    }

    /** Reads one (possibly multi-line) SMTP reply and returns its numeric code. */
    private static function reply($fp): int
    {
        $code = 0;
        while (($line = fgets($fp, 515)) !== false) {
            $code = (int) substr($line, 0, 3);
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $code;
    }

    private static function cmd($fp, string $line, array $ok): void
    {
        fwrite($fp, $line . "\r\n");
        $code = self::reply($fp);
        if (!in_array($code, $ok, true)) throw new RuntimeException("SMTP: unexpected $code after command");
    }

    private static function smtp(string $to, string $from, string $message): void
    {
        $host = (string) Config::get('mail.host');
        $port = (int) Config::get('mail.port', 465);
        $enc = (string) Config::get('mail.encryption', 'ssl');
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host]]);
        $fp = @stream_socket_client(($enc === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) throw new RuntimeException("SMTP connect failed: $errstr ($errno)");
        stream_set_timeout($fp, 20);
        try {
            if (self::reply($fp) !== 220) throw new RuntimeException('SMTP: no greeting');
            $me = 'api.games.slowatcoding.com';
            self::cmd($fp, "EHLO $me", [250]);
            if ($enc === 'tls') {
                self::cmd($fp, 'STARTTLS', [220]);
                if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP: STARTTLS failed');
                self::cmd($fp, "EHLO $me", [250]);
            }
            self::cmd($fp, 'AUTH LOGIN', [334]);
            self::cmd($fp, base64_encode((string) Config::get('mail.user')), [334]);
            self::cmd($fp, base64_encode((string) Config::get('mail.pass')), [235]);
            self::cmd($fp, "MAIL FROM:<$from>", [250]);
            self::cmd($fp, "RCPT TO:<$to>", [250, 251]);
            self::cmd($fp, 'DATA', [354]);
            // Dot-stuffing: a line starting with "." would end the message early.
            $data = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $message));
            $data = str_replace("\n", "\r\n", $data);
            fwrite($fp, $data . "\r\n.\r\n");
            if (self::reply($fp) !== 250) throw new RuntimeException('SMTP: message rejected');
            @fwrite($fp, "QUIT\r\n");
        } finally {
            fclose($fp);
        }
    }

    // ---- The emails ----

    public static function otp(string $to, string $name, string $code, string $purpose): void
    {
        $app = (string) Config::get('app_name', 'Games');
        $hello = $name !== '' ? "Hi $name," : 'Hi,';
        if ($purpose === 'reset') {
            $subject = "$code is your $app password reset code";
            $what = 'reset your password';
        } else {
            $subject = "$code is your $app verification code";
            $what = 'verify your email address';
        }
        $text = "$hello\n\nYour code to $what is:\n\n    $code\n\nIt works for 10 minutes. If you didn't ask for this, you can ignore this email; nothing will change.\n\n- $app";
        $html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#1c2433">'
            . '<p>' . htmlspecialchars($hello) . '</p><p>Your code to ' . $what . ' is:</p>'
            . '<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">' . $code . '</p>'
            . "<p style=\"color:#5a6577\">It works for 10 minutes. If you didn't ask for this, you can ignore this email; nothing will change.</p>"
            . '<p style="color:#5a6577">- ' . htmlspecialchars($app) . '</p></div>';
        self::send($to, $subject, $text, $html);
    }

    public static function alreadyRegistered(string $to): void
    {
        $app = (string) Config::get('app_name', 'Games');
        $text = "Someone tried to create a $app account with this email address, but you already have one.\n\nSign in with your password, or use \"Forgot password\" if you don't remember it. If this wasn't you, no action is needed.\n\n- $app";
        $html = '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#1c2433"><p>' . nl2br(htmlspecialchars($text)) . '</p></div>';
        self::send($to, "You already have a $app account", $text, $html);
    }
}
