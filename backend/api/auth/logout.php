<?php
/**
 * Legacy Logout Forwarder
 * Routes legacy logout calls directly to the Unified Session Controller
 */
$_REQUEST['action'] = 'logout';
$_GET['action'] = 'logout';
require_once __DIR__ . '/session.php';
