<?php
/**
 * Legacy Login Forwarder
 * Routes legacy login calls directly to the Unified Session Controller
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $_REQUEST['action'] = 'login';
    $_GET['action'] = 'login';
}
require_once __DIR__ . '/session.php';
