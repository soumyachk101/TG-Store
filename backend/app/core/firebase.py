"""Firebase Core: Initialize Firebase Admin SDK.
"""

import json
import os
import firebase_admin
from firebase_admin import credentials
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


def initialize_firebase():
    """Initializes the Firebase Admin app. Supports multiple configuration paths."""
    try:
        # Check if already initialized
        firebase_admin.get_app()
        return
    except ValueError:
        pass

    if settings.firebase_mock_auth:
        logger.info("Firebase Mock Authentication is active. Admin SDK initialization skipped.")
        return

    # 1. Check Path configuration
    if settings.firebase_service_account_path:
        path = settings.firebase_service_account_path
        if os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                logger.info(f"Firebase initialized successfully using service account JSON path: {path}")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase using path {path}: {e}")
        else:
            # Try to resolve relative to backend package root
            # __file__ is backend/app/core/firebase.py -> backend/
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            alternative_path = os.path.join(backend_root, os.path.basename(path))
            if os.path.exists(alternative_path):
                try:
                    cred = credentials.Certificate(alternative_path)
                    firebase_admin.initialize_app(cred)
                    logger.info(f"Firebase initialized successfully using resolved service account JSON path: {alternative_path}")
                    return
                except Exception as e:
                    logger.warning(f"Failed to initialize Firebase using resolved path {alternative_path}: {e}")

    # 2. Check JSON string configuration
    if settings.firebase_service_account_json:
        try:
            info = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(info)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully using service account credentials JSON string.")
            return
        except Exception as e:
            logger.warning(f"Failed to parse/use firebase_service_account_json env: {e}")

    # 3. Fallback to Application Default Credentials (ADC) or credentials file in standard path
    has_gcp_creds = "GOOGLE_APPLICATION_CREDENTIALS" in os.environ
    has_gcp_env = any(env in os.environ for env in ["GAE_ENV", "K_SERVICE", "CLOUD_RUN_SERVICE"])

    if has_gcp_creds or has_gcp_env:
        try:
            firebase_admin.initialize_app()
            logger.info("Firebase initialized using Application Default Credentials (ADC).")
        except Exception as e:
            if settings.firebase_service_account_path:
                logger.warning(f"Firebase service account path not found at: {settings.firebase_service_account_path}")
            logger.warning(f"Could not initialize Firebase Admin SDK natively ({e}). "
                  "Requests requiring token verification will fail unless mock auth is enabled.")
    else:
        logger.info("Firebase is not configured (no service account JSON, path file, or GCP environment). "
              "Token verification via Firebase will be inactive, falling back to local JWT.")


