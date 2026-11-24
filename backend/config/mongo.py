import os
from pymongo import MongoClient

mongo_client = None
mongo_db = None


def init_mongo(app):
    global mongo_client, mongo_db
    uri = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017/')
    db_name = os.getenv('MONGO_DB', 'ride_booking')
    mongo_client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    mongo_db = mongo_client[db_name]
    app.extensions['mongo_db'] = mongo_db


def get_mongo():
    return mongo_db


def check_mongo():
    mongo_client.admin.command('ping')
