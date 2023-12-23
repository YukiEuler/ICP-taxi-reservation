import {
  Canister,
  query,
  update,
  Result,
  text,
  Vec,
  Record,
  StableBTreeMap,
  Principal,
  ic,
  int8,
  float64,
} from 'azle';
import { v4 as uuidv4 } from 'uuid';

const Driver = Record({
  id: text,
  name: text,
  phoneNumber: text,
  createdDate: ic.time(),
});

const Customer = Record({
  id: text,
  name: text,
  phoneNumber: text,
  createdDate: ic.time(),
});

const Reservation = Record({
  id: text,
  customerId: text,
  pickupLocation: text,
  destination: text,
  status: int8,
  price: float64,
  driverId: text,
  reservationDate: ic.time(),
});

const reservationStatus: { [key: number]: string } = {
  0: 'Waiting',
  1: 'Accepted',
  2: 'On the Way',
  3: 'Arrived',
  4: 'Cancelled',
};

const customerStorage = StableBTreeMap(text, Customer, 0);
const driverStorage = StableBTreeMap(text, Driver, 0);
const reservationStorage = StableBTreeMap(text, Reservation, 0);

function isValidPhoneNumber(number: text): boolean {
  const regexExp = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return regexExp.test(number);
}

function driverInStorage(id: text): boolean {
  return driverStorage.get(id).isSome;
}

function reservationInStorage(id: text): Reservation | null {
  const reservationOpt = reservationStorage.get(id);
  return reservationOpt.isSome ? reservationOpt.unwrap() : null;
}

function driverInOrder(id: text): boolean {
  return reservationStorage.values().some(
    (reservation: typeof Reservation) => reservation.driverId === id && (reservation.status === 1 || reservation.status === 2)
  );
}

export default Canister({
  registerCustomer: update([text, text], Result(text, text), (name, phoneNumber) => {
    if (!isValidPhoneNumber(phoneNumber)) {
      return Result.Err('Number phone is not valid!');
    }
    const cust: typeof Customer = {
      id: uuidv4(),
      name: name,
      phoneNumber: phoneNumber,
      createdDate: ic.time(),
    };
    customerStorage.insert(cust.id, cust);
    return Result.Ok(cust.id);
  }),

  registerDriver: update([text, text], Result(text, text), (name, phoneNumber) => {
    if (!isValidPhoneNumber(phoneNumber)) {
      return Result.Err('Number phone is not valid!');
    }
    const driver: typeof Driver = {
      id: uuidv4(),
      name: name,
      phoneNumber: phoneNumber,
      createdDate: ic.time(),
    };
    driverStorage.insert(driver.id, driver);
    return Result.Ok(driver.id);
  }),

  createReservation: update([text, text, text], Result(text, text), (customerId, pickupLocation, destination) => {
    const customerOpt = customerStorage.get(customerId);
    if (customerOpt.isNone) {
      return Result.Err('Customer is not registered');
    }
    const reservation: typeof Reservation = {
      id: uuidv4(),
      customerId: customerId,
      pickupLocation: pickupLocation,
      destination: destination,
      status: 0,
      price: 0,
      driverId: '',
      reservationDate: ic.time(),
    };
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Transaction with ID ${reservation.id} was created successfully`);
  }),

  // Other update and query functions...

});

globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
