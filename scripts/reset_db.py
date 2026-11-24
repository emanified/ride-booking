"""Wipe all non-admin data from MongoDB, keeping only admin user(s).

Deletes every passenger/driver account, trip, trip event, payment, earning,
notification, message, vehicle, and driver review. Admin users (role='admin')
in the `users` collection are left untouched.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
from flask import Flask
from config.mongo import init_mongo, get_mongo

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

app = Flask(__name__)
init_mongo(app)

COLLECTIONS_TO_CLEAR = [
    'trips',
    'trip_events',
    'payments',
    'driver_earnings',
    'notifications',
    'messages',
    'driver_reviews',
    'vehicles',
]


def main():
    with app.app_context():
        db = get_mongo()

        result = db.users.delete_many({'role': {'$ne': 'admin'}})
        print(f'users: removed {result.deleted_count} non-admin account(s)')

        for name in COLLECTIONS_TO_CLEAR:
            result = db[name].delete_many({})
            print(f'{name}: removed {result.deleted_count} document(s)')

        remaining_admins = db.users.count_documents({'role': 'admin'})
        print(f'Remaining admin user(s): {remaining_admins}')


if __name__ == '__main__':
    main()
