"""Firebase Core: Initialize Firebase Admin SDK.
"""

import json
import os
import firebase_admin
from firebase_admin import credentials
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
        path = settings.firebase_service_account_path
        if os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                print(f"INFO: Firebase initialized successfully using service account JSON path: {path}")
                return
            except Exception as e:
                print(f"WARNING: Failed to initialize Firebase using path {path}: {e}")
        else:
            # Try to resolve relative to backend package root
            # __file__ is backend/app/core/firebase.py -> backend/
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            alternative_path = os.path.join(backend_root, os.path.basename(path))
            if os.path.exists(alternative_path):
                try:
                    cred = credentials.Certificate(alternative_path)
                    firebase_admin.initialize_app(cred)
                    print(f"INFO: Firebase initialized successfully using resolved service account JSON path: {alternative_path}")
                    return
                except Exception as e:
                    print(f"WARNING: Failed to initialize Firebase using resolved path {alternative_path}: {e}")

    # 2. Check JSON string configuration
    if settings.firebase_service_account_json:
        try:
            info = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(info)
            firebase_admin.initialize_app(cred)
            print("INFO: Firebase initialized successfully using service account credentials JSON string.")
            return
        except Exception as e:
            print(f"WARNING: Failed to parse/use firebase_service_account_json env: {e}")

    # 3. Fallback to Application Default Credentials (ADC) or credentials file in standard path
    try:
        firebase_admin.initialize_app()
        print("INFO: Firebase initialized using Application Default Credentials (ADC).")
    except Exception as e:
        if settings.firebase_service_account_path:
            print(f"WARNING: Firebase service account path not found at: {settings.firebase_service_account_path}")
        print(f"WARNING: Could not initialize Firebase Admin SDK natively ({e}). "
              "Requests requiring token verification will fail unless mock auth is enabled.")

