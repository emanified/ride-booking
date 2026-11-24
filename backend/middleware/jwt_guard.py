import jwt
from functools import wraps
from flask import request, jsonify, current_app

def token_required(*roles):
    """
    Decorator to protect routes with JWT.
    Usage:
        @token_required()                        # any logged in user
        @token_required('admin')                 # admin only
        @token_required('passenger', 'admin')    # passenger or admin
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = None
            auth_header = request.headers.get('Authorization')

            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

            if not token:
                return jsonify({'error': 'Token is missing'}), 401

            try:
                payload = jwt.decode(
                    token,
                    current_app.config['SECRET_KEY'],
                    algorithms=['HS256']
                )
                request.user = payload  # attach user to request

                if roles and payload.get('role') not in roles:
                    return jsonify({'error': 'Access forbidden'}), 403

            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401

            return f(*args, **kwargs)
        return wrapper
    return decorator
