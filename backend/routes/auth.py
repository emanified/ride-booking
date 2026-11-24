from flask import Blueprint, request, jsonify, current_app
import bcrypt
import jwt
import datetime
import store

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')
    role = data.get('role')

    if not name or not email or not password or not phone:
        return jsonify({'error': 'name, email, password, and phone are required'}), 400

    if role not in ('passenger', 'driver'):
        return jsonify({'error': 'Invalid role'}), 400

    if store.find_user_by_email(email):
        return jsonify({'error': 'Email already registered'}), 400

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    driver_profile = None
    if role == 'driver':
        driver_profile = {
            'license_number': data.get('license_number'),
            'vehicle_model': data.get('vehicle_model'),
            'vehicle_plate': data.get('vehicle_plate'),
            'vehicle_type': data.get('vehicle_type', 'car'),
        }

    try:
        store.create_user(name, email, hashed, phone, role, driver_profile)
        return jsonify({'message': 'Registered successfully'}), 201
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Invalid credentials'}), 401

    user = store.find_user_by_email(email)
    if not user or not user.get('is_active', True):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = jwt.encode(
        {
            'user_id': user['user_id'],
            'role': user['role'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
        },
        current_app.config['SECRET_KEY'],
        algorithm='HS256',
    )
    if isinstance(token, bytes):
        token = token.decode('utf-8')

    return jsonify({
        'token': token,
        'user': {
            'user_id': user['user_id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
        },
    })
