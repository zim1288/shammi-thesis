<?php
/**
 * Controller: User Session & Authentication (Persistent & Secure)
 * ESP32 Home Patient Monitoring System
 */
require_once __DIR__ . '/../../src/Core/Response.php';
require_once __DIR__ . '/../../src/Core/Request.php';
require_once __DIR__ . '/../../src/Core/Security.php';
require_once __DIR__ . '/../../src/Repositories/UserRepository.php';

use App\Core\Response;
use App\Core\Request;
use App\Core\Security;
use App\Repositories\UserRepository;

$request  = new Request();
$action   = strtolower(trim($request->get('action', 'check')));
$userRepo = new UserRepository();

// -----------------------------------------------------------------------------
// ACTION: LOGIN
// -----------------------------------------------------------------------------
if ($action === 'login') {
    $username = trim($request->get('username', ''));
    $password = $request->getRaw('password', ''); // Preserves special characters

    if (empty($username) || empty($password)) {
        Response::error('Email/Username and Password are required.', 422);
    }

    $matchedUser = $userRepo->verifyCredentials($username, $password);

    if ($matchedUser) {
        session_regenerate_id(true);
        $_SESSION['user_id']   = $matchedUser['id'] ?? 'USR-001';
        $_SESSION['username']  = $matchedUser['username'];
        $_SESSION['email']     = $matchedUser['email'] ?? $matchedUser['username'];
        $_SESSION['full_name'] = $matchedUser['full_name'] ?? 'Dr. S. Jenkins, MD';
        $_SESSION['role']      = $matchedUser['role'] ?? 'attending_physician';

        Response::success([
            'user' => [
                'id'            => $_SESSION['user_id'],
                'username'      => $_SESSION['username'],
                'email'         => $_SESSION['email'],
                'full_name'     => $_SESSION['full_name'],
                'role'          => $_SESSION['role'],
                'authenticated' => true
            ],
            'csrf_token' => Security::generateCsrfToken()
        ], 'Login successful');
    } else {
        Response::error('Invalid email or password. Please verify your credentials.', 401);
    }

// -----------------------------------------------------------------------------
// ACTION: REGISTER
// -----------------------------------------------------------------------------
} elseif ($action === 'register') {
    $fullName = trim($request->get('name', ''));
    $email    = strtolower(trim($request->get('email', '')));
    $password = $request->getRaw('password', '');

    if (empty($fullName) || empty($email) || empty($password)) {
        Response::error('Full Name, Email and Password are required.', 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Response::error('Please provide a valid email address.', 422);
    }

    if (strlen($password) < 6) {
        Response::error('Password must be at least 6 characters long.', 422);
    }

    $newUser = $userRepo->create([
        'name'     => $fullName,
        'email'    => $email,
        'password' => $password
    ]);

    if (!$newUser) {
        Response::error('An account with this email address already exists. Please login.', 409);
    }

    // Auto-authenticate newly registered user
    session_regenerate_id(true);
    $_SESSION['user_id']   = $newUser['id'];
    $_SESSION['username']  = $newUser['username'];
    $_SESSION['email']     = $newUser['email'];
    $_SESSION['full_name'] = $newUser['full_name'];
    $_SESSION['role']      = $newUser['role'];

    Response::success([
        'user' => [
            'id'            => $newUser['id'],
            'username'      => $newUser['username'],
            'email'         => $newUser['email'],
            'full_name'     => $newUser['full_name'],
            'role'          => $newUser['role'],
            'authenticated' => true
        ],
        'csrf_token' => Security::generateCsrfToken()
    ], 'Account registered successfully', 201);

// -----------------------------------------------------------------------------
// ACTION: LOGOUT
// -----------------------------------------------------------------------------
} elseif ($action === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    Response::success([], 'Logged out successfully');

// -----------------------------------------------------------------------------
// ACTION: CHECK SESSION STATUS
// -----------------------------------------------------------------------------
} else {
    $isAuth = !empty($_SESSION['user_id']);
    Response::success([
        'authenticated' => $isAuth,
        'user'          => $isAuth ? [
            'id'        => $_SESSION['user_id'],
            'username'  => $_SESSION['username'],
            'email'     => $_SESSION['email'] ?? $_SESSION['username'],
            'full_name' => $_SESSION['full_name'],
            'role'      => $_SESSION['role']
        ] : null,
        'csrf_token'    => Security::generateCsrfToken()
    ]);
}
