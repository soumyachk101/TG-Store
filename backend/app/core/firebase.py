"""Firebase Core: Initialize Firebase Admin SDK.
"""

import json
import os
import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import get_settings

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
        print("INFO: Firebase Mock Authentication is active. Admin SDK initialization skipped.")
        return

    # 1. Check Path configuration
    if settings.firebase_service_account_path:
        if os.path.exists(settings.firebase_service_account_path):
            cred = credentials.Certificate(settings.firebase_service_account_path)
            firebase_admin.initialize_app(cred)
            print("INFO: Firebase initialized successfully using service account JSON path.")
            return
        else:
            print(f"WARNING: Firebase service account path not found at: {settings.firebase_service_account_path}")

    # 2. Check JSON string configuration
    if settings.firebase_service_account_json:
        try:
            info = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(info)
            firebase_admin.initialize_app(cred)
            print("INFO: Firebase initialized successfully using service account credentials JSON string.")
            return
        except Exception as e:
            print(f"WARNING: Failed to parse firebase_service_account_json env: {e}")

    # 3. Fallback to Application Default Credentials (ADC) or credentials file in standard path
    try:
        firebase_admin.initialize_app()
        print("INFO: Firebase initialized using Application Default Credentials (ADC).")
    except Exception as e:
        print(f"WARNING: Could not initialize Firebase Admin SDK natively ({e}). "
              "Requests requiring token verification will fail unless mock auth is enabled.")
