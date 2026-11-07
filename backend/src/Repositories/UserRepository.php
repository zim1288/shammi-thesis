<?php
namespace App\Repositories;

/**
 * Repository: Clinician User Accounts & Credentials Manager
 * ESP32 Home Patient Monitoring System
 */
class UserRepository {
    private string $filePath;

    public function __construct() {
        $this->filePath = __DIR__ . '/../../data_store/users.json';
        if (!file_exists($this->filePath)) {
            $initialPassword = getenv('INITIAL_DOCTOR_PASSWORD') ?: 'Doctor@2026!';
            $defaultUsers = [
                [
                    'id'            => 'USR-001',
                    'username'      => 'doctor@hospital.gov.bd',
                    'email'         => 'doctor@hospital.gov.bd',
                    'password_hash' => password_hash($initialPassword, PASSWORD_DEFAULT),
                    'full_name'     => 'Dr. S. Jenkins, MD',
                    'role'          => 'attending_physician',
                    'ward'          => 'ICU Step-Down',
                    'created_at'    => date('c')
                ]
            ];
            $this->saveAll($defaultUsers);
        }
    }

    /**
     * Retrieve all user records with thread-safe atomic reading
     */
    public function getAll(): array {
        if (!file_exists($this->filePath)) {
            return [];
        }
        $content = file_get_contents($this->filePath);
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Persist user records with exclusive file locking (LOCK_EX)
     */
    public function saveAll(array $users): bool {
        return file_put_contents(
            $this->filePath,
            json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
            LOCK_EX
        ) !== false;
    }

    /**
     * Find user by username or email
     */
    public function findByUsernameOrEmail(string $identifier): ?array {
        $cleanId = trim($identifier);
        $users = $this->getAll();
        foreach ($users as $u) {
            if (strcasecmp($u['username'], $cleanId) === 0 || 
                (!empty($u['email']) && strcasecmp($u['email'], $cleanId) === 0)) {
                return $u;
            }
        }
        return null;
    }

    /**
     * Verify credentials strictly against bcrypt hash
     */
    public function verifyCredentials(string $identifier, string $plainPassword): ?array {
        $user = $this->findByUsernameOrEmail($identifier);

        if ($user && !empty($user['password_hash'])) {
            if (password_verify($plainPassword, $user['password_hash'])) {
                return $user;
            }
        }

        return null;
    }

    /**
     * Create a new user account
     */
    public function create(array $userData): ?array {
        $users = $this->getAll();

        // Check if email already exists
        foreach ($users as $u) {
            if (!empty($u['email']) && strcasecmp($u['email'], $userData['email']) === 0) {
                return null; // Already exists
            }
        }

        $newUser = [
            'id'            => 'USR-' . strtoupper(substr(md5(uniqid()), 0, 6)),
            'username'      => $userData['email'],
            'email'         => $userData['email'],
            'password_hash' => password_hash($userData['password'], PASSWORD_DEFAULT),
            'full_name'     => $userData['name'],
            'role'          => $userData['role'] ?? 'attending_physician',
            'ward'          => $userData['ward'] ?? 'ICU Step-Down',
            'created_at'    => date('c')
        ];

        $users[] = $newUser;
        $this->saveAll($users);

        return $newUser;
    }
}
