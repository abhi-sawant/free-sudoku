<?php
declare(strict_types=1);

/** An error the client should see: HTTP status, a stable machine code, and a human message. */
final class ApiError extends Exception
{
    public function __construct(public int $status, public string $errorCode, string $message, public array $extra = [])
    {
        parent::__construct($message);
    }
}

final class Http
{
    private const MAX_BODY = 4 * 1024 * 1024;

    /** Sends the CORS headers for an allowed origin. Browsers of other origins get none, and are blocked. */
    public static function cors(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = (array) Config::get('allowed_origins', []);
        header('Vary: Origin');
        if ($origin !== '' && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
            header('Access-Control-Max-Age: 86400');
        }
    }

    public static function json(int $status, array $body): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    /** The request body as an array. Rejects bodies that are too big or not a JSON object. */
    public static function body(): array
    {
        $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($len > self::MAX_BODY) throw new ApiError(413, 'too_large', 'That request is too large.');
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY + 1);
        if ($raw === false || $raw === '') return [];
        if (strlen($raw) > self::MAX_BODY) throw new ApiError(413, 'too_large', 'That request is too large.');
        $data = json_decode($raw, true);
        if (!is_array($data)) throw new ApiError(400, 'bad_json', 'The request body must be a JSON object.');
        return $data;
    }

    public static function clientIp(): string
    {
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
    }

    public static function bearer(): ?string
    {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if ($h === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
        }
        return preg_match('/^Bearer\s+([A-Za-z0-9]{20,128})$/', (string) $h, $m) ? $m[1] : null;
    }
}
