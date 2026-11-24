import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from config.mongo import init_mongo, check_mongo
from routes.auth import auth_bp
from routes.passenger import passenger_bp
from routes.driver import driver_bp
from routes.admin import admin_bp
from routes.notifications import notifications_bp
import store

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-change-me')

CORS(app, origins=['http://localhost:5173', 'http://127.0.0.1:5173'])

init_mongo(app)

try:
    store.ensure_vehicle_indexes()
    store.ensure_geospatial_indexes()  # Phase 4: 2dsphere + supporting indexes
except Exception:
    # Don't block app startup if Mongo isn't reachable yet; indexes can be
    # created later once the database is available.
    pass

app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(passenger_bp, url_prefix='/passenger')
app.register_blueprint(driver_bp, url_prefix='/driver')
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(notifications_bp, url_prefix='')


@app.route('/health', methods=['GET'])
def health():
    try:
        check_mongo()
        return jsonify({'api': 'ok', 'mongodb': 'connected'}), 200
    except Exception as exc:
        return jsonify({'api': 'ok', 'mongodb': f'error: {exc}'}), 503


if __name__ == '__main__':
    app.run(debug=True, port=5000)
