"""Create or reset the default admin user in MongoDB."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import bcrypt
from dotenv import load_dotenv
from flask import Flask
from config.mongo import init_mongo
import store

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

app = Flask(__name__)
init_mongo(app)

EMAIL = 'admin@ridebook.com'
PASSWORD = 'admin123'
NAME = 'Admin'


def main():
    hashed = bcrypt.hashpw(PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    with app.app_context():
        if store.find_user_by_email(EMAIL):
            store.update_user_password(EMAIL, hashed)
            print(f'Updated admin password for {EMAIL}')
        else:
            store.create_user(NAME, EMAIL, hashed, None, 'admin')
            print(f'Created admin {EMAIL}')
    print(f'Login: {EMAIL} / {PASSWORD}')


if __name__ == '__main__':
    main()
