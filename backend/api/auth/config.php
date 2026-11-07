<?php
/**
 * Controller: Public Client-Side Application Configuration
 * Exposes non-sensitive public parameters (like EmailJS client IDs) safely to the browser.
 */
require_once __DIR__ . '/../../src/Core/Response.php';

use App\Core\Response;

// Load EmailJS public settings strictly from environment variables
$emailJsPublicKey  = getenv('EMAILJS_PUBLIC_KEY')  ?: '';
$emailJsServiceId  = getenv('EMAILJS_SERVICE_ID')  ?: '';
$emailJsTemplateId = getenv('EMAILJS_TEMPLATE_ID') ?: '';

Response::success([
    'emailjs' => [
        'publicKey'  => $emailJsPublicKey,
        'serviceId'  => $emailJsServiceId,
        'templateId' => $emailJsTemplateId
    ],
    'prototype_notice' => 'Educational Prototype — Not for Diagnosis'
], 'Public configuration fetched');
