"""MongoDB data access for the ride booking app."""
from datetime import datetime
from pymongo import ReturnDocument
from config.mongo import get_mongo
from utils.fare_calculator import vehicle_type_label


def _db():
    return get_mongo()


def next_id(name):
    doc = _db().counters.find_one_and_update(
        {'_id': name},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc['seq']


def _serialize_dt(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


# --- Users ---

def find_user_by_email(email):
    return _db().users.find_one({'email': email})


def find_user_by_id(user_id):
    return _db().users.find_one({'user_id': int(user_id)})


def create_user(name, email, password_hash, phone, role, driver_profile=None):
    user_id = next_id('user_id')
    doc = {
        'user_id': user_id,
        'name': name,
        'email': email,
        'password': password_hash,
        'phone': phone,
        'role': role,
        'is_active': True,
        'created_at': datetime.utcnow(),
    }
    if driver_profile:
        doc['driver_profile'] = {
            **driver_profile,
            'is_available': False,
            'avg_rating': 0.0,
            'total_trips': 0,
        }
    _db().users.insert_one(doc)
    if role == 'driver':
        _db().driver_reviews.insert_one({'driver_id': user_id, 'reviews': []})
    return user_id


def update_user_password(email, password_hash, role='admin'):
    _db().users.update_one(
        {'email': email},
        {'$set': {'password': password_hash, 'role': role, 'is_active': True}},
    )


def set_user_active(user_id, is_active):
    updates = {'is_active': is_active}
    user = find_user_by_id(user_id)
    if user and user.get('role') == 'driver' and not is_active:
        updates['driver_profile.is_available'] = False
    _db().users.update_one({'user_id': int(user_id)}, {'$set': updates})


def list_users(role=None, status=None):
    query = {}
    if role:
        query['role'] = role
    if status == 'active':
        query['is_active'] = True
    elif status == 'suspended':
        query['is_active'] = False

    users = []
    for doc in _db().users.find(query).sort('created_at', -1):
        users.append({
            'user_id': doc['user_id'],
            'name': doc['name'],
            'email': doc['email'],
            'phone': doc.get('phone'),
            'role': doc['role'],
            'is_active': doc.get('is_active', True),
            'created_at': _serialize_dt(doc.get('created_at')),
        })
    return users


def count_users(role=None, active_only=True):
    query = {}
    if role:
        query['role'] = role
    if active_only:
        query['is_active'] = True
    return _db().users.count_documents(query)


# --- Trips ---

def create_trip_broadcast(passenger_id, pickup, dropoff, coords, fare,
                           vehicle_type, pickup_place_id=None,
                           dropoff_place_id=None, estimate=None):
    """
    Create a trip in 'pending_driver' (open broadcast) status. No driver is
    pre-matched — any online driver with a matching vehicle type can see the
    request and either accept it at `minimumFare` or submit a counter-offer.
    `fare`/`minimumFare` is the passenger's requested minimum; the trip's
    `fare` field is overwritten with the final agreed amount once a driver
    is locked in (see driver_accept_at_minimum / passenger_accept_offer).
    """
    trip_id = next_id('trip_id')
    now = datetime.utcnow()

    doc = {
        'trip_id': trip_id,
        'passenger_id': int(passenger_id),
        'driver_id': None,
        'pickup_location': pickup,
        'dropoff_location': dropoff,
        'pickup_lat': coords['pickup_lat'],
        'pickup_lng': coords['pickup_lng'],
        'dropoff_lat': coords['dropoff_lat'],
        'dropoff_lng': coords['dropoff_lng'],
        'pickup': {
            'address': pickup,
            'lat': coords['pickup_lat'],
            'lng': coords['pickup_lng'],
            'placeId': pickup_place_id or '',
        },
        'dropoff': {
            'address': dropoff,
            'lat': coords['dropoff_lat'],
            'lng': coords['dropoff_lng'],
            'placeId': dropoff_place_id or '',
        },
        'vehicleType': vehicle_type,
        'vehicle_type': vehicle_type,
        'estimate': estimate,
        'status': 'pending_driver',
        'fare': fare,
        'minimumFare': fare,
        'offers': [],
        'declinedBy': [],
        'requested_at': now,
        'accepted_at': None,
        'completed_at': None,
    }
    _db().trips.insert_one(doc)
    add_trip_event(trip_id, 'pending_driver', now)
    return trip_id, doc


def find_trip(trip_id):
    return _db().trips.find_one({'trip_id': int(trip_id)})


def find_trip_for_passenger(trip_id, passenger_id):
    return _db().trips.find_one({
        'trip_id': int(trip_id),
        'passenger_id': int(passenger_id),
    })


def find_trip_for_driver(trip_id, driver_id):
    return _db().trips.find_one({
        'trip_id': int(trip_id),
        'driver_id': int(driver_id),
    })


def get_active_trip_view(trip_id, driver_id):
    """
    Trip view for the driver's Active Trip map. Exposes pickup/dropoff
    coordinates, vehicle type, and the stored fare estimate (Phase 2: no live
    tracking, just the data already on the trip document).
    """
    trip = find_trip_for_driver(trip_id, driver_id)
    if not trip:
        return None
    passenger = find_user_by_id(trip['passenger_id'])
    return {
        'trip_id': trip['trip_id'],
        'status': trip['status'],
        'pickup_location': trip.get('pickup_location'),
        'dropoff_location': trip.get('dropoff_location'),
        'pickup_lat': trip.get('pickup_lat'),
        'pickup_lng': trip.get('pickup_lng'),
        'dropoff_lat': trip.get('dropoff_lat'),
        'dropoff_lng': trip.get('dropoff_lng'),
        'pickup': trip.get('pickup'),
        'dropoff': trip.get('dropoff'),
        'vehicleType': trip.get('vehicleType'),
        'estimate': trip.get('estimate'),
        'passenger_name': passenger['name'] if passenger else 'Passenger',
    }


def list_passenger_history(passenger_id):
    trips = _db().trips.find(
        {'passenger_id': int(passenger_id), 'status': 'completed'},
        {'_id': 0},
    ).sort('completed_at', -1)

    rides = []
    for trip in trips:
        driver_name = '—'
        if trip.get('driver_id'):
            driver = find_user_by_id(trip['driver_id'])
            if driver:
                driver_name = driver.get('name', '—')
        rides.append({
            'trip_id': trip['trip_id'],
            'pickup': trip.get('pickup') or trip.get('pickup_location'),
            'dropoff': trip.get('dropoff') or trip.get('dropoff_location'),
            'fare': float(trip['fare']),
            'status': trip['status'],
            'date': _serialize_dt(trip.get('completed_at')),
            'driver_name': driver_name,
        })
    return rides


def list_admin_trips(status=None, date_from=None, date_to=None):
    query = {}
    if status:
        query['status'] = status

    trips = []
    for trip in _db().trips.find(query).sort('requested_at', -1):
        if date_from and trip.get('requested_at') and trip['requested_at'] < date_from:
            continue
        if date_to and trip.get('requested_at') and trip['requested_at'] > date_to:
            continue

        passenger = find_user_by_id(trip['passenger_id'])
        driver_id = trip.get('driver_id')
        driver = find_user_by_id(driver_id) if driver_id else None
        vehicle = None
        if driver_id:
            vehicle_doc = get_vehicle_by_driver(driver_id)
            if vehicle_doc:
                vehicle = serialize_vehicle(vehicle_doc)
        trips.append({
            'trip_id': trip['trip_id'],
            'passenger': passenger['name'] if passenger else '—',
            'driver': driver['name'] if driver else None,
            'pickup_location': trip['pickup_location'],
            'dropoff_location': trip['dropoff_location'],
            'status': trip['status'],
            'fare': float(trip['fare']),
            'minimumFare': float(trip.get('minimumFare', trip['fare'])),
            'vehicleType': trip.get('vehicleType'),
            'vehicle': vehicle,
            'requested_at': _serialize_dt(trip.get('requested_at')),
            'completed_at': _serialize_dt(trip.get('completed_at')),
            'driverAssigned': driver_id is not None,
            'offersCount': len(trip.get('offers', []) or []),
        })
    return trips


def count_trips(status):
    return _db().trips.count_documents({'status': status})


ACTIVE_TRIP_STATUSES = ['pending_driver', 'accepted', 'driver_arriving', 'arrived', 'started', 'awaiting_payment']


def count_active_trips():
    """Count trips that are booked but not yet completed/cancelled."""
    return _db().trips.count_documents({'status': {'$in': ACTIVE_TRIP_STATUSES}})


def list_driver_ride_history(driver_id):
    """Completed rides for a driver's 'Recent rides' page, newest first."""
    trips = _db().trips.find(
        {'driver_id': int(driver_id), 'status': 'completed'},
        {'_id': 0},
    ).sort('completed_at', -1)

    reviews_doc = _db().driver_reviews.find_one({'driver_id': int(driver_id)}) or {}
    reviews_by_trip = {r['trip_id']: r for r in reviews_doc.get('reviews', [])}

    result = []
    for trip in trips:
        passenger = find_user_by_id(trip['passenger_id'])
        payment = find_payment_by_trip(trip['trip_id'])
        review = reviews_by_trip.get(trip['trip_id'])
        result.append({
            'trip_id': trip['trip_id'],
            'passenger_name': passenger['name'] if passenger else 'Passenger',
            'pickup_location': trip.get('pickup_location') or (trip.get('pickup') or {}).get('address', ''),
            'dropoff_location': trip.get('dropoff_location') or (trip.get('dropoff') or {}).get('address', ''),
            'vehicleType': trip.get('vehicleType') or trip.get('vehicle_type'),
            'fare': float(trip.get('fare', 0)),
            'startedAt': _serialize_dt(trip.get('startedAt')),
            'completedAt': _serialize_dt(trip.get('completed_at')),
            'paymentStatus': payment['status'] if payment else 'pending',
            'rating': review.get('rating') if review else None,
        })
    return result


def increment_driver_trips(driver_id):
    _db().users.update_one(
        {'user_id': int(driver_id)},
        {'$inc': {'driver_profile.total_trips': 1}},
    )


# --- Trip events ---

def add_trip_event(trip_id, status, when=None, message=None):
    """
    Create a structured trip event document in `trip_events` collection.
    Keeps event documents per-event (one document per event) so they can be
    queried and sorted efficiently. Backwards-compatible callers can continue
    to use this function.
    """
    when = when or datetime.utcnow()
    event = {
        'tripId': int(trip_id),
        'eventType': status if isinstance(status, str) else str(status),
        'message': message if message else status,
        'createdBy': None,
        'createdByRole': 'system',
        'metadata': {},
        'createdAt': when,
    }
    _db().trip_events.insert_one(event)


def get_trip_events(trip_id):
    # Return structured events sorted by createdAt ascending. Support both
    # the legacy arrays (older format) and the new per-event documents.
    cursor = _db().trip_events.find({'tripId': int(trip_id)}).sort('createdAt', 1)
    events = []
    for doc in cursor:
        events.append({
            'eventType': doc.get('eventType'),
            'message': doc.get('message'),
            'createdBy': doc.get('createdBy'),
            'createdByRole': doc.get('createdByRole'),
            'metadata': doc.get('metadata', {}),
            'createdAt': _serialize_dt(doc.get('createdAt')),
        })

    # Legacy compatibility: older single-document shape with `events` array.
    if not events:
        legacy = _db().trip_events.find_one({'trip_id': int(trip_id)}, {'_id': 0})
        if legacy and legacy.get('events'):
            for e in legacy.get('events', []):
                events.append({'eventType': e.get('status'), 'message': e.get('status'), 'createdAt': e.get('timestamp')})
    return events


def update_driver_trip_location(driver_id, trip_id, lat, lng, manual=False):
    """Update driver's user location and the trip's driverLocation snapshot.

    If `manual` is True we also create a `driver_location_updated` trip event.
    """
    now = datetime.utcnow()
    # Update user currentLocation (GeoJSON)
    _db().users.update_one(
        {'user_id': int(driver_id), 'role': 'driver'},
        {'$set': {
            'currentLocation': {'type': 'Point', 'coordinates': [float(lng), float(lat)]},
            'currentLocationUpdatedAt': now,
        }},
    )

    # Update trip driverLocation snapshot
    _db().trips.update_one(
        {'trip_id': int(trip_id)},
        {'$set': {
            'driverLocation': {'lat': float(lat), 'lng': float(lng), 'updatedAt': now},
            'updated_at': now,
        }},
    )

    if manual:
        add_trip_event(trip_id, 'driver_location_updated', now)


def validate_trip_status_transition(current_status, new_status):
    """Return True if transition is allowed, else False."""
    allowed = {
        'pending_driver': ['accepted'],
        'accepted': ['driver_arriving'],
        'driver_arriving': ['arrived'],
        'arrived': ['started'],
        'started': ['awaiting_payment'],
        'awaiting_payment': ['completed'],
    }
    if current_status == new_status:
        return True
    return new_status in allowed.get(current_status, [])


def update_trip_status(driver_id, trip_id, new_status):
    """Validate and apply a trip status transition initiated by driver.

    Returns a dict with {'success': True, 'trip': trip} or {'error': '...'}.
    """
    trip = find_trip(trip_id)
    if not trip:
        return {'error': 'Trip not found'}

    current = trip.get('status')
    assigned_driver = trip.get('driver_id')
    if assigned_driver is None or int(assigned_driver) != int(driver_id):
        return {'error': 'You are not the assigned driver for this trip'}

    if current in ('awaiting_payment', 'completed'):
        return {'error': 'Trip is already completed'}

    if not validate_trip_status_transition(current, new_status):
        return {'error': f'Invalid status transition: {current} -> {new_status}'}

    now = datetime.utcnow()
    updates = {'status': new_status, 'updated_at': now}
    event_map = {
        'driver_arriving': 'driver_arriving',
        'arrived': 'driver_arrived',
        'started': 'trip_started',
        'awaiting_payment': 'trip_completed',
    }
    ts_field_map = {
        'driver_arriving': 'driverArrivingAt',
        'arrived': 'arrivedAt',
        'started': 'startedAt',
        'awaiting_payment': 'completedAt',
    }
    if new_status in ts_field_map:
        updates[ts_field_map[new_status]] = now
        if new_status == 'awaiting_payment':
            updates['completed_at'] = now

    _db().trips.update_one({'trip_id': int(trip_id)}, {'$set': updates})

    # Add trip event
    add_trip_event(trip_id, event_map.get(new_status, new_status), now)

    # The driver's job is done once the ride itself is over, even though the
    # trip doesn't become 'completed' until the passenger pays — release them
    # back to the available pool right away rather than blocking on payment.
    if new_status == 'awaiting_payment':
        _db().users.update_one({'user_id': int(driver_id), 'role': 'driver'}, {'$set': {'isAvailable': True, 'activeTripId': None}})
        increment_driver_trips(driver_id)

    return {'success': True, 'trip': find_trip(trip_id)}


NON_CANCELLABLE_STATUSES = ('started', 'awaiting_payment', 'completed', 'cancelled')


def cancel_trip_by_passenger(passenger_id, trip_id, reason=None):
    """Cancel a trip on the passenger's behalf.

    Allowed any time before the ride has actually started (pending_driver,
    assigned, accepted, driver_arriving, arrived). Once the trip is 'started'
    or later, it can no longer be cancelled. Releases any reserved driver
    back to the available pool and notifies them.

    Returns {'success': True, 'trip': trip} or {'error': '...'}.
    """
    trip = find_trip(trip_id)
    if not trip:
        return {'error': 'Trip not found'}
    if int(trip.get('passenger_id')) != int(passenger_id):
        return {'error': 'You do not own this trip'}

    current = trip.get('status')
    if current in NON_CANCELLABLE_STATUSES:
        return {'error': f'Trip can no longer be cancelled (status: {current}).'}

    now = datetime.utcnow()
    driver_id = trip.get('driver_id')

    _db().trips.update_one(
        {'trip_id': int(trip_id)},
        {'$set': {
            'status': 'cancelled',
            'cancelledAt': now,
            'cancelledBy': 'passenger',
            'cancellationReason': reason,
            'updated_at': now,
        }},
    )
    add_trip_event(trip_id, 'cancelled', now, message=reason)

    if driver_id:
        release_driver_from_request(driver_id, trip_id)
        add_notification(
            int(driver_id), 'driver', 'trip', 'Ride cancelled',
            f'The passenger cancelled trip #{trip_id}.', {'tripId': int(trip_id)},
        )
    else:
        # No driver locked in yet — notify anyone with a pending offer that the request is gone.
        for offer in trip.get('offers', []) or []:
            if offer.get('status') == 'pending':
                add_notification(
                    int(offer['driverId']), 'driver', 'trip', 'Ride cancelled',
                    f'The passenger cancelled trip #{trip_id} before responding to your offer.',
                    {'tripId': int(trip_id)},
                )

    add_notification(
        int(passenger_id), 'passenger', 'trip', 'Ride cancelled',
        f'You cancelled trip #{trip_id}.', {'tripId': int(trip_id)},
    )

    updated_trip = _db().trips.find_one({'trip_id': int(trip_id)}, {'_id': 0})
    return {'success': True, 'trip': updated_trip}


# --- Payments ---

def find_payment_by_trip(trip_id):
    return _db().payments.find_one({'trip_id': int(trip_id)})


def sum_completed_payments():
    pipeline = [
        {'$match': {'status': 'completed'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
    ]
    result = list(_db().payments.aggregate(pipeline))
    return float(result[0]['total']) if result else 0.0


def list_admin_payments():
    payments = []
    for doc in _db().payments.find().sort('paid_at', -1):
        trip = find_trip(doc['trip_id'])
        passenger = find_user_by_id(doc['passenger_id'])
        payments.append({
            'payment_id': doc['payment_id'],
            'amount': float(doc['amount']),
            'status': doc['status'],
            'paid_at': _serialize_dt(doc.get('paid_at')),
            'reference_id': doc.get('reference_id'),
            'passenger': passenger['name'] if passenger else '—',
            'pickup_location': trip['pickup_location'] if trip else '',
            'dropoff_location': trip['dropoff_location'] if trip else '',
        })
    return payments


# --- Phase 8: Payments, Earnings, Notifications, Messages ---
def pay_trip_by_passenger(passenger_id, trip_id):
    """Process demo payment for a finished trip awaiting payment.

    The ride only becomes 'completed' once this succeeds — paying is what
    actually closes out the trip, not the driver marking it done.

    Returns dict with keys: success, payment, driverEarningsUpdated or error.
    """
    trip = find_trip(trip_id)
    if not trip:
        return {'error': 'Trip not found'}
    if int(trip.get('passenger_id')) != int(passenger_id):
        return {'error': 'You do not own this trip'}
    if trip.get('status') == 'completed':
        return {'error': 'Trip already paid'}
    if trip.get('status') != 'awaiting_payment':
        return {'error': 'Trip is not ready for payment yet'}
    if not trip.get('driver_id'):
        return {'error': 'Trip has no assigned driver yet'}
    if not trip.get('fare'):
        return {'error': 'Trip has no fare set'}

    existing = find_payment_by_trip(trip_id)
    if existing and existing.get('status') in ('paid', 'completed'):
        return {'error': 'Payment already completed'}

    driver_id = trip.get('driver_id')
    amount = float(trip.get('fare'))
    payment_id = next_id('payment_id')
    now = datetime.utcnow()
    payment = {
        'payment_id': payment_id,
        'trip_id': int(trip_id),
        'passenger_id': int(passenger_id),
        'amount': float(amount),
        'reference_id': f'AUTO-DEMO-{payment_id}',
        'status': 'completed',
        'paid_at': now,
        'created_at': now,
        'updated_at': now,
    }
    _db().payments.update_one({'trip_id': int(trip_id)}, {'$set': payment}, upsert=True)

    # Payment is what finally closes out the ride.
    _db().trips.update_one({'trip_id': int(trip_id)}, {'$set': {'status': 'completed', 'updated_at': now}})

    # Add trip event for payment completed
    add_trip_event(trip_id, 'payment_completed', now)

    # Create driver earning record (idempotent)
    earning = _db().driver_earnings.find_one({'trip_id': int(trip_id)})
    driverEarningsUpdated = False
    if not earning:
        earn_doc = {
            'driver_earning_id': next_id('earning_id'),
            'driverId': int(driver_id),
            'trip_id': int(trip_id),
            'payment_id': int(payment_id),
            'grossAmount': float(amount),
            'platformCommission': 0.0,
            'netAmount': float(amount),
            'currency': 'PKR',
            'status': 'earned',
            'earnedAt': now,
            'createdAt': now,
            'updatedAt': now,
        }
        try:
            _db().driver_earnings.insert_one(earn_doc)
            driverEarningsUpdated = True
            # Update user's total earnings summary (safe incremental)
            _db().users.update_one({'user_id': int(driver_id), 'role': 'driver'}, {'$inc': {'driver_profile.totalEarnings': float(amount)}}, upsert=False)
        except Exception:
            # If insert fails due to race/unique constraint, skip
            driverEarningsUpdated = False

    # Notification to driver and passenger
    add_notification(int(driver_id), 'driver', 'payment', 'Ride paid', f'Passenger paid for trip #{trip_id}', {'tripId': int(trip_id)})
    add_notification(int(passenger_id), 'passenger', 'payment', 'Payment received', f'Payment recorded for trip #{trip_id}', {'tripId': int(trip_id)})

    payment_doc = _db().payments.find_one({'trip_id': int(trip_id)}, {'_id': 0})
    return {'success': True, 'payment': payment_doc, 'driverEarningsUpdated': driverEarningsUpdated}


def add_notification(userId, role, ntype, title, message, metadata=None):
    now = datetime.utcnow()
    doc = {
        'userId': int(userId),
        'role': role,
        'type': ntype,
        'title': title,
        'message': message,
        'isRead': False,
        'metadata': metadata or {},
        'createdAt': now,
    }
    _db().notifications.insert_one(doc)
    return doc


def list_notifications_for_user(user_id, role=None):
    query = {'userId': int(user_id)}
    if role:
        query['role'] = role
    docs = list(_db().notifications.find(query).sort('createdAt', -1))
    out = []
    for d in docs:
        out.append({
            'id': str(d.get('_id')),
            'title': d.get('title'),
            'message': d.get('message'),
            'type': d.get('type'),
            'isRead': d.get('isRead', False),
            'metadata': d.get('metadata', {}),
            'createdAt': _serialize_dt(d.get('createdAt')),
        })
    return out


def mark_notification_read(notification_id, user_id):
    res = _db().notifications.update_one({'_id': notification_id, 'userId': int(user_id)}, {'$set': {'isRead': True}})
    return res.modified_count > 0


def post_message(trip_id, sender_id, receiver_id, senderRole, message_text):
    """Post a chat message tied to a trip."""
    if not message_text or len(message_text.strip()) == 0:
        return {'error': 'Message is required'}
    if len(message_text) > 1000:
        return {'error': 'Message too long'}
    now = datetime.utcnow()
    message_id = next_id('message_id')
    doc = {
        'messageId': message_id,
        'tripId': int(trip_id),
        'senderId': int(sender_id),
        'receiverId': int(receiver_id) if receiver_id is not None else None,
        'senderRole': senderRole,
        'message': message_text,
        'isRead': False,
        'readAt': None,
        'createdAt': now,
    }
    _db().messages.insert_one(doc)
    return {
        'success': True,
        'message': {
            'messageId': message_id,
            'senderId': doc['senderId'],
            'receiverId': doc['receiverId'],
            'senderRole': doc['senderRole'],
            'message': doc['message'],
            'isRead': False,
            'readAt': None,
            'createdAt': _serialize_dt(now),
        },
    }


def list_messages_for_trip(trip_id):
    docs = list(_db().messages.find({'tripId': int(trip_id)}).sort('createdAt', 1))
    out = []
    for d in docs:
        out.append({
            'messageId': d.get('messageId'),
            'senderId': d.get('senderId'),
            'receiverId': d.get('receiverId'),
            'senderRole': d.get('senderRole'),
            'message': d.get('message'),
            'isRead': d.get('isRead', False),
            'readAt': _serialize_dt(d.get('readAt')),
            'createdAt': _serialize_dt(d.get('createdAt')),
        })
    return out


def mark_messages_read(trip_id, reader_role):
    """
    Mark every message sent by the other party on this trip as read by
    `reader_role` ('passenger' or 'driver'), stamping the moment they were
    seen. Called when that party opens the chat dialog, not on every
    background poll — otherwise the unread badge would clear itself before
    the user ever sees it.
    """
    sender_role = 'driver' if reader_role == 'passenger' else 'passenger'
    now = datetime.utcnow()
    _db().messages.update_many(
        {'tripId': int(trip_id), 'senderRole': sender_role, 'isRead': False},
        {'$set': {'isRead': True, 'readAt': now}},
    )


def list_driver_earnings(driver_id):
    docs = list(_db().driver_earnings.find({'driverId': int(driver_id)}).sort('earnedAt', -1))
    out = []
    for d in docs:
        trip = find_trip(d.get('trip_id'))
        out.append({
            'trip_id': d.get('trip_id'),
            'amount': float(d.get('netAmount', 0)),
            'currency': d.get('currency', 'PKR'),
            'earnedAt': _serialize_dt(d.get('earnedAt')),
            'pickup': trip.get('pickup', {}).get('address') if trip else None,
            'dropoff': trip.get('dropoff', {}).get('address') if trip else None,
        })
    total = sum(d.get('netAmount', 0) for d in docs)
    return out, float(total)


def driver_earnings_summary(driver_id):
    db = _db()
    match = {'driverId': int(driver_id)}
    total = float(list(db.driver_earnings.aggregate([{'$match': match}, {'$group': {'_id': None, 'total': {'$sum': '$netAmount'}}}]))[0]['total']) if db.driver_earnings.count_documents(match) > 0 else 0.0
    # simple today/weekly/monthly by date range
    from datetime import timedelta
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = datetime(now.year, now.month, 1)
    def sum_since(start):
        pipeline = [{'$match': {'driverId': int(driver_id), 'earnedAt': {'$gte': start}}}, {'$group': {'_id': None, 'total': {'$sum': '$netAmount'}, 'count': {'$sum': 1}}}]
        res = list(db.driver_earnings.aggregate(pipeline))
        if res:
            return float(res[0].get('total', 0)), int(res[0].get('count', 0))
        return 0.0, 0
    today_total, today_count = sum_since(today_start)
    week_total, week_count = sum_since(week_start)
    month_total, month_count = sum_since(month_start)
    return {
        'totalEarnings': total,
        'todayEarnings': today_total,
        'weeklyEarnings': week_total,
        'monthlyEarnings': month_total,
        'totalPaidTrips': int(db.driver_earnings.count_documents({'driverId': int(driver_id)})),
        'currency': 'PKR',
    }


# --- Reviews ---

def trip_already_reviewed(driver_id, trip_id):
    return _db().driver_reviews.find_one({
        'driver_id': int(driver_id),
        'reviews.trip_id': int(trip_id),
    }) is not None


def add_driver_review(driver_id, trip_id, passenger_id, passenger_name, rating, comment):
    _db().driver_reviews.update_one(
        {'driver_id': int(driver_id)},
        {'$push': {'reviews': {
            'trip_id': int(trip_id),
            'passenger_id': int(passenger_id),
            'passenger_name': passenger_name,
            'rating': rating,
            'comment': comment,
            'reviewed_at': datetime.utcnow().isoformat(),
        }}},
        upsert=True,
    )
    doc = _db().driver_reviews.find_one({'driver_id': int(driver_id)})
    reviews = doc.get('reviews', [])
    avg = round(sum(r['rating'] for r in reviews) / len(reviews), 2) if reviews else 0
    _db().users.update_one(
        {'user_id': int(driver_id)},
        {'$set': {'driver_profile.avg_rating': avg}},
    )
    return avg


# --- Vehicles (Phase 3) ---

def ensure_vehicle_indexes():
    """Create indexes for the vehicles collection. Safe to call repeatedly."""
    _db().vehicles.create_index('driverId')
    _db().vehicles.create_index('number', unique=True)
    _db().vehicles.create_index('status')
    _db().vehicles.create_index('type')


def serialize_vehicle(doc):
    if not doc:
        return None
    return {
        'id': doc['vehicle_id'],
        'driverId': doc['driverId'],
        'type': doc['type'],
        'typeLabel': vehicle_type_label(doc['type']),
        'brand': doc.get('brand', ''),
        'model': doc.get('model', ''),
        'number': doc.get('number', ''),
        'color': doc.get('color', ''),
        'capacity': doc.get('capacity'),
        'year': doc.get('year'),
        'status': doc.get('status', 'pending'),
        'isApproved': doc.get('isApproved', False),
        'rejectionReason': doc.get('rejectionReason', ''),
        'createdAt': _serialize_dt(doc.get('createdAt')),
        'updatedAt': _serialize_dt(doc.get('updatedAt')),
        'approvedAt': _serialize_dt(doc.get('approvedAt')),
        'approvedBy': doc.get('approvedBy'),
    }


def get_vehicle_by_driver(driver_id):
    return _db().vehicles.find_one({'driverId': int(driver_id)})


def get_vehicle_by_id(vehicle_id):
    return _db().vehicles.find_one({'vehicle_id': int(vehicle_id)})


def find_vehicle_by_number(number, exclude_vehicle_id=None):
    query = {'number': number}
    if exclude_vehicle_id is not None:
        query['vehicle_id'] = {'$ne': int(exclude_vehicle_id)}
    return _db().vehicles.find_one(query)


def create_vehicle(driver_id, data):
    vehicle_id = next_id('vehicle_id')
    now = datetime.utcnow()
    doc = {
        'vehicle_id': vehicle_id,
        'driverId': int(driver_id),
        'type': data['type'],
        'brand': data.get('brand', ''),
        'model': data['model'],
        'number': data['number'],
        'color': data['color'],
        'capacity': data['capacity'],
        'year': data.get('year'),
        'isApproved': False,
        'status': 'pending',
        'rejectionReason': '',
        'createdAt': now,
        'updatedAt': now,
        'approvedAt': None,
        'approvedBy': None,
    }
    _db().vehicles.insert_one(doc)
    return doc


def update_vehicle(vehicle_id, data, reset_to_pending=False):
    updates = {**data, 'updatedAt': datetime.utcnow()}
    if reset_to_pending:
        updates['status'] = 'pending'
        updates['isApproved'] = False
        updates['rejectionReason'] = ''
        updates['approvedAt'] = None
        updates['approvedBy'] = None
    _db().vehicles.update_one({'vehicle_id': int(vehicle_id)}, {'$set': updates})
    return get_vehicle_by_id(vehicle_id)


def delete_vehicle(vehicle_id):
    _db().vehicles.delete_one({'vehicle_id': int(vehicle_id)})


def get_vehicles(status=None):
    query = {}
    if status:
        query['status'] = status

    vehicles = []
    for doc in _db().vehicles.find(query).sort('createdAt', -1):
        item = serialize_vehicle(doc)
        driver = find_user_by_id(doc['driverId'])
        item['driverName'] = driver['name'] if driver else '—'
        item['driverEmail'] = driver.get('email') if driver else None
        item['driverPhone'] = driver.get('phone') if driver else None
        vehicles.append(item)
    return vehicles


def approve_vehicle(vehicle_id, admin_id):
    now = datetime.utcnow()
    _db().vehicles.update_one(
        {'vehicle_id': int(vehicle_id)},
        {'$set': {
            'status': 'approved',
            'isApproved': True,
            'rejectionReason': '',
            'approvedAt': now,
            'approvedBy': int(admin_id),
            'updatedAt': now,
        }},
    )
    return get_vehicle_by_id(vehicle_id)


def reject_vehicle(vehicle_id, reason):
    _db().vehicles.update_one(
        {'vehicle_id': int(vehicle_id)},
        {'$set': {
            'status': 'rejected',
            'isApproved': False,
            'rejectionReason': reason,
            'updatedAt': datetime.utcnow(),
        }},
    )
    return get_vehicle_by_id(vehicle_id)


def driver_has_active_trip(driver_id):
    """Check whether a driver currently has a trip in progress.

    Broadcast requests don't lock in a driver until they're accepted, so this
    only needs to look at `driver_id` (set once a driver wins a request).
    """
    query = {
        'driver_id': int(driver_id),
        'status': {'$in': ['accepted', 'driver_arriving', 'arrived', 'started']},
    }
    return _db().trips.count_documents(query) > 0

# ============================================================
# Phase 4 — Driver Location & Online/Offline / Nearest Driver
# ============================================================

def ensure_geospatial_indexes():
    """Create all Phase 4 indexes. Safe to call repeatedly (idempotent)."""
    db = _db()
    # 2dsphere index required for $near queries on driver location.
    db.users.create_index([('currentLocation', '2dsphere')], sparse=True)
    # Supporting indexes for the geospatial + availability query.
    db.users.create_index('role')
    db.users.create_index('isOnline')
    db.users.create_index('isAvailable')
    db.users.create_index('vehicleType')
    # Trip indexes.
    db.trips.create_index('status')
    db.trips.create_index('passenger_id')
    db.trips.create_index('driver_id')
    # Broadcast list lookup: open requests filtered by vehicle type.
    db.trips.create_index([('status', 1), ('vehicleType', 1)])
    # Events index for Phase 6
    db.trip_events.create_index([('tripId', 1), ('createdAt', 1)])
    # Payments, earnings, notifications, messages indexes for Phase 8
    db.payments.create_index('trip_id', unique=True, sparse=True)
    db.payments.create_index('passenger_id')
    db.payments.create_index('driver_id')
    db.payments.create_index('status')

    db.driver_earnings.create_index('trip_id', unique=True, sparse=True)
    db.driver_earnings.create_index('driverId')
    db.driver_earnings.create_index('earnedAt')

    db.notifications.create_index([('userId', 1), ('isRead', 1)])
    db.notifications.create_index('createdAt')

    db.messages.create_index([('tripId', 1), ('createdAt', 1)])


def update_driver_location(driver_id, lat, lng):
    """Store/update a driver's current GeoJSON Point location."""
    _db().users.update_one(
        {'user_id': int(driver_id), 'role': 'driver'},
        {'$set': {
            'currentLocation': {
                'type': 'Point',
                'coordinates': [float(lng), float(lat)],  # GeoJSON: [lng, lat]
            },
            'currentLocationUpdatedAt': datetime.utcnow(),
        }},
    )


def set_driver_online(driver_id, lat, lng):
    """
    Mark driver online+available, store current location, and sync
    vehicleType from their approved vehicle. Raises ValueError if the
    driver has no approved vehicle.
    """
    vehicle = get_vehicle_by_driver(driver_id)
    if not vehicle or not vehicle.get('isApproved'):
        raise ValueError('Your vehicle must be approved before you can go online.')

    now = datetime.utcnow()
    _db().users.update_one(
        {'user_id': int(driver_id), 'role': 'driver'},
        {'$set': {
            'isOnline': True,
            'isAvailable': True,
            'vehicleType': vehicle.get('type'),
            'currentLocation': {
                'type': 'Point',
                'coordinates': [float(lng), float(lat)],
            },
            'currentLocationUpdatedAt': now,
        }},
    )


def set_driver_offline(driver_id):
    """Mark driver offline and unavailable. Does NOT remove currentLocation."""
    _db().users.update_one(
        {'user_id': int(driver_id), 'role': 'driver'},
        {'$set': {'isOnline': False, 'isAvailable': False}},
    )


def get_driver_status(driver_id):
    """Return online/availability/location status for a driver."""
    user = find_user_by_id(driver_id)
    if not user or user.get('role') != 'driver':
        return None
    loc = user.get('currentLocation')
    coords = loc.get('coordinates') if loc else None
    return {
        'isOnline': user.get('isOnline', False),
        'isAvailable': user.get('isAvailable', False),
        'vehicleType': user.get('vehicleType'),
        'currentLocation': loc,
        'lat': coords[1] if coords else None,
        'lng': coords[0] if coords else None,
        'currentLocationUpdatedAt': _serialize_dt(user.get('currentLocationUpdatedAt')),
        'activeTripId': user.get('activeTripId'),
    }


def reserve_driver_for_trip(driver_id, trip_id):
    """
    Atomically mark driver unavailable and set activeTripId.
    The update filter ensures the driver is still online+available at the moment
    of reservation to prevent double-assignment.
    Returns True if the reservation succeeded.
    """
    result = _db().users.update_one(
        {
            'user_id': int(driver_id),
            'role': 'driver',
            'isOnline': True,
            'isAvailable': True,
            'activeTripId': None,
        },
        {'$set': {'isAvailable': False, 'activeTripId': int(trip_id)}},
    )
    return result.modified_count == 1


def release_driver_from_request(driver_id, trip_id):
    """Release a reserved driver from a pending/assigned request."""
    _db().users.update_one(
        {
            'user_id': int(driver_id),
            'role': 'driver',
            'activeTripId': int(trip_id),
        },
        {'$set': {'isAvailable': True, 'activeTripId': None}},
    )


def get_assigned_trips_for_driver(driver_id):
    """Return this driver's current trip(s) once a request has been accepted."""
    assigned_driver_id = int(driver_id)
    candidate_trips = list(_db().trips.find({
        'driver_id': assigned_driver_id,
        'status': {'$in': ['accepted', 'driver_arriving', 'arrived', 'started']},
    }, {'_id': 0}).sort('requested_at', -1))

    results = []
    for trip in candidate_trips:
        passenger = find_user_by_id(trip['passenger_id'])
        results.append({
            'trip_id': trip['trip_id'],
            'passenger_name': passenger['name'] if passenger else 'Passenger',
            'pickup_location': trip.get('pickup_location') or (trip.get('pickup') or {}).get('address', ''),
            'dropoff_location': trip.get('dropoff_location') or (trip.get('dropoff') or {}).get('address', ''),
            'pickup': trip.get('pickup'),
            'dropoff': trip.get('dropoff'),
            'fare': float(trip['fare']),
            'status': trip['status'],
            'vehicleType': trip.get('vehicleType') or trip.get('vehicle_type'),
            'estimate': trip.get('estimate'),
        })
    return results


def _serialize_offer(offer):
    return {
        'offerId': offer.get('offerId'),
        'driverId': offer.get('driverId'),
        'driverName': offer.get('driverName'),
        'fare': float(offer.get('fare')),
        'status': offer.get('status'),
        'createdAt': _serialize_dt(offer.get('createdAt')),
        'respondedAt': _serialize_dt(offer.get('respondedAt')),
    }


def list_broadcast_requests_for_driver(driver_id):
    """
    Open (pending_driver) trips a driver can see: matching vehicle type, not
    already declined by them. No geo-filtering — every online driver with the
    right vehicle type sees every open request, per the broadcast model.
    """
    driver = find_user_by_id(driver_id)
    vehicle_type = driver.get('vehicleType') if driver else None

    query = {
        'status': 'pending_driver',
        'declinedBy': {'$ne': int(driver_id)},
    }
    if vehicle_type:
        query['vehicleType'] = vehicle_type

    results = []
    for trip in _db().trips.find(query).sort('requested_at', -1):
        passenger = find_user_by_id(trip['passenger_id'])
        my_offers = [o for o in (trip.get('offers') or []) if o.get('driverId') == int(driver_id)]
        my_latest_offer = my_offers[-1] if my_offers else None
        results.append({
            'trip_id': trip['trip_id'],
            'passenger_name': passenger['name'] if passenger else 'Passenger',
            'pickup_location': trip.get('pickup_location') or (trip.get('pickup') or {}).get('address', ''),
            'dropoff_location': trip.get('dropoff_location') or (trip.get('dropoff') or {}).get('address', ''),
            'pickup': trip.get('pickup'),
            'dropoff': trip.get('dropoff'),
            'minimumFare': float(trip.get('minimumFare', trip['fare'])),
            'vehicleType': trip.get('vehicleType') or trip.get('vehicle_type'),
            'estimate': trip.get('estimate'),
            'myOffer': _serialize_offer(my_latest_offer) if my_latest_offer else None,
        })
    return results


def driver_accept_at_minimum(trip_id, driver_id):
    """
    Driver accepts the ride at the passenger's minimum fare. Atomically wins
    the trip (status pending_driver -> accepted) so a simultaneous accept by
    another driver, or the passenger accepting someone else's offer, cannot
    also succeed. If the subsequent driver reservation fails (the driver went
    offline/got busy in the gap), the trip is rolled back to pending_driver.
    """
    trip = find_trip(trip_id)
    if not trip:
        return {'error': 'Trip not found'}
    if trip.get('status') != 'pending_driver':
        return {'error': 'This ride is no longer available.'}

    now = datetime.utcnow()
    final_fare = float(trip.get('minimumFare', trip['fare']))

    won = _db().trips.find_one_and_update(
        {'trip_id': int(trip_id), 'status': 'pending_driver'},
        {'$set': {
            'status': 'accepted',
            'driver_id': int(driver_id),
            'fare': final_fare,
            'accepted_at': now,
            'updated_at': now,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not won:
        return {'error': 'This ride was just taken by another driver.'}

    if not reserve_driver_for_trip(driver_id, trip_id):
        _db().trips.update_one(
            {'trip_id': int(trip_id)},
            {'$set': {'status': 'pending_driver', 'driver_id': None, 'accepted_at': None}},
        )
        return {'error': 'Could not reserve you for this ride. Please try again.'}

    add_trip_event(trip_id, 'accepted', now, message='Driver accepted at minimum fare')
    add_notification(
        int(trip['passenger_id']), 'passenger', 'trip', 'Driver found',
        f'A driver accepted your ride at the requested fare.', {'tripId': int(trip_id)},
    )
    return {'success': True, 'trip': won}


def driver_submit_offer(trip_id, driver_id, fare):
    """Driver counter-offers a higher fare on an open broadcast request."""
    trip = find_trip(trip_id)
    if not trip:
        return {'error': 'Trip not found'}
    if trip.get('status') != 'pending_driver':
        return {'error': 'This ride is no longer available.'}

    minimum = float(trip.get('minimumFare', trip['fare']))
    try:
        fare = float(fare)
    except (TypeError, ValueError):
        return {'error': 'Offer fare must be a number.'}
    if fare <= minimum:
        return {'error': f'Your offer must be higher than the minimum fare ({minimum}).'}

    driver = find_user_by_id(driver_id)
    now = datetime.utcnow()
    offer = {
        'offerId': next_id('offer_id'),
        'driverId': int(driver_id),
        'driverName': driver.get('name') if driver else 'Driver',
        'fare': fare,
        'status': 'pending',
        'createdAt': now,
        'respondedAt': None,
    }
    _db().trips.update_one({'trip_id': int(trip_id)}, {'$push': {'offers': offer}})
    add_notification(
        int(trip['passenger_id']), 'passenger', 'trip', 'New fare offer',
        f'A driver offered {fare} for your ride.', {'tripId': int(trip_id), 'offerId': offer['offerId']},
    )
    return {'success': True, 'offer': _serialize_offer(offer)}


def driver_decline_request(trip_id, driver_id):
    """Driver opts out of a broadcast request — it stops showing up for them."""
    _db().trips.update_one(
        {'trip_id': int(trip_id), 'status': 'pending_driver'},
        {'$addToSet': {'declinedBy': int(driver_id)}},
    )
    return {'success': True}


def passenger_accept_offer(trip_id, passenger_id, offer_id):
    """
    Passenger accepts one driver's counter-offer. Atomically wins the trip the
    same way driver_accept_at_minimum does, then marks every other pending
    offer 'superseded'. Rolls back (and un-supersedes the other offers) if the
    chosen driver can no longer be reserved.
    """
    trip = find_trip_for_passenger(trip_id, passenger_id)
    if not trip:
        return {'error': 'Trip not found'}
    if trip.get('status') != 'pending_driver':
        return {'error': 'This ride is no longer pending.'}

    offer = next((o for o in (trip.get('offers') or []) if o.get('offerId') == int(offer_id)), None)
    if not offer or offer.get('status') != 'pending':
        return {'error': 'This offer is no longer available.'}

    now = datetime.utcnow()
    won = _db().trips.find_one_and_update(
        {'trip_id': int(trip_id), 'status': 'pending_driver'},
        {'$set': {
            'status': 'accepted',
            'driver_id': int(offer['driverId']),
            'fare': float(offer['fare']),
            'accepted_at': now,
            'updated_at': now,
            'offers.$[accepted].status': 'accepted',
            'offers.$[accepted].respondedAt': now,
        }},
        array_filters=[{'accepted.offerId': int(offer_id)}],
        return_document=ReturnDocument.AFTER,
    )
    if not won:
        return {'error': 'This ride was just taken.'}

    _db().trips.update_one(
        {'trip_id': int(trip_id)},
        {'$set': {'offers.$[other].status': 'superseded', 'offers.$[other].respondedAt': now}},
        array_filters=[{'other.status': 'pending', 'other.offerId': {'$ne': int(offer_id)}}],
    )

    if not reserve_driver_for_trip(offer['driverId'], trip_id):
        # Compensating rollback: no multi-document transactions on a standalone
        # mongod, so undo the trip lock and the supersede by hand.
        _db().trips.update_one(
            {'trip_id': int(trip_id)},
            {'$set': {
                'status': 'pending_driver',
                'driver_id': None,
                'accepted_at': None,
                'offers.$[accepted].status': 'pending',
                'offers.$[accepted].respondedAt': None,
            }},
            array_filters=[{'accepted.offerId': int(offer_id)}],
        )
        _db().trips.update_one(
            {'trip_id': int(trip_id)},
            {'$set': {'offers.$[other].status': 'pending', 'offers.$[other].respondedAt': None}},
            array_filters=[{'other.status': 'superseded'}],
        )
        add_notification(
            int(offer['driverId']), 'driver', 'trip', 'Could not confirm ride',
            'You became unavailable before the ride could be confirmed.', {'tripId': int(trip_id)},
        )
        add_notification(
            int(passenger_id), 'passenger', 'trip', 'Driver unavailable',
            'That driver is no longer available. Please choose another offer or wait for a new one.',
            {'tripId': int(trip_id)},
        )
        return {'error': 'That driver just became unavailable. Please pick another offer.'}

    add_trip_event(trip_id, 'accepted', now, message=f"Passenger accepted an offer of {offer['fare']}")
    add_notification(
        int(offer['driverId']), 'driver', 'trip', 'Offer accepted',
        f"The passenger accepted your offer of {offer['fare']} for trip #{trip_id}.", {'tripId': int(trip_id)},
    )
    return {'success': True, 'trip': won}


def passenger_reject_offer(trip_id, passenger_id, offer_id):
    """Passenger rejects a single offer; the driver may still submit a new one."""
    trip = find_trip_for_passenger(trip_id, passenger_id)
    if not trip:
        return {'error': 'Trip not found'}

    offer = next((o for o in (trip.get('offers') or []) if o.get('offerId') == int(offer_id)), None)
    if not offer or offer.get('status') != 'pending':
        return {'error': 'This offer is no longer available.'}

    now = datetime.utcnow()
    _db().trips.update_one(
        {'trip_id': int(trip_id)},
        {'$set': {'offers.$[target].status': 'rejected', 'offers.$[target].respondedAt': now}},
        array_filters=[{'target.offerId': int(offer_id)}],
    )
    add_notification(
        int(offer['driverId']), 'driver', 'trip', 'Offer rejected',
        f"The passenger rejected your offer of {offer['fare']}. You can submit a new offer.",
        {'tripId': int(trip_id)},
    )
    return {'success': True}


def get_trip_status_view_phase4(trip_id, passenger_id):
    """
    Trip status view for the passenger's Ride Status page: driver/vehicle info
    once accepted, plus the live list of offers while still pending_driver.
    """
    trip = find_trip_for_passenger(trip_id, passenger_id)
    if not trip:
        return None

    driver_name = None
    driver_rating = None
    driver_phone = None
    vehicle_model = None
    vehicle_plate = None
    vehicle = None
    driver_id = trip.get('driver_id')

    if driver_id:
        driver = find_user_by_id(driver_id)
        if driver:
            driver_name = driver.get('name')
            driver_phone = driver.get('phone')
            profile = driver.get('driver_profile', {})
            driver_rating = profile.get('avg_rating')
            vehicle_model = profile.get('vehicle_model')
            vehicle_plate = profile.get('vehicle_plate')
        vehicle_doc = get_vehicle_by_driver(driver_id)
        if vehicle_doc and vehicle_doc.get('isApproved'):
            vehicle = serialize_vehicle(vehicle_doc)

    passenger = find_user_by_id(passenger_id)

    offers = [_serialize_offer(o) for o in (trip.get('offers') or [])]
    payment = find_payment_by_trip(trip_id)
    is_paid = bool(payment and payment.get('status') in ('paid', 'completed'))
    is_rated = bool(driver_id) and trip_already_reviewed(driver_id, trip_id)

    return {
        'status': trip['status'],
        'isPaid': is_paid,
        'isRated': is_rated,
        'fare': trip['fare'],
        'minimumFare': float(trip.get('minimumFare', trip['fare'])),
        'accepted_at': _serialize_dt(trip.get('accepted_at')),
        'startedAt': _serialize_dt(trip.get('startedAt')),
        'completed_at': _serialize_dt(trip.get('completed_at')),
        'driver_name': driver_name,
        'driver_phone': driver_phone,
        'driver_rating': driver_rating,
        'passenger_name': passenger.get('name') if passenger else None,
        'passenger_phone': passenger.get('phone') if passenger else None,
        'vehicle_model': vehicle_model,
        'vehicle_plate': vehicle_plate,
        'vehicle': vehicle,
        'pickup_location': trip.get('pickup_location'),
        'dropoff_location': trip.get('dropoff_location'),
        'pickup_lat': trip.get('pickup_lat'),
        'pickup_lng': trip.get('pickup_lng'),
        'dropoff_lat': trip.get('dropoff_lat'),
        'dropoff_lng': trip.get('dropoff_lng'),
        'pickup': trip.get('pickup'),
        'dropoff': trip.get('dropoff'),
        'vehicleType': trip.get('vehicleType') or trip.get('vehicle_type'),
        'estimate': trip.get('estimate'),
        'driverLocation': {
            'lat': trip.get('driverLocation', {}).get('lat'),
            'lng': trip.get('driverLocation', {}).get('lng'),
            'updatedAt': _serialize_dt((trip.get('driverLocation') or {}).get('updatedAt')),
        },
        'driver_lat': (trip.get('driverLocation') or {}).get('lat'),
        'driver_lng': (trip.get('driverLocation') or {}).get('lng'),
        'driverAssigned': driver_id is not None,
        'offers': offers,
    }
