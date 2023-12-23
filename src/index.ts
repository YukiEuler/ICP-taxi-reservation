import { Canister, query, text, update, Void, Vec, Record, StableBTreeMap, Result, nat64, float64, ic, Opt, Principal, Variant, AzleResult, Ok, Err, int8, bool, nat8, float32, int16} from 'azle';
import { v4 as uuidv4 } from "uuid";

const Driver = Record({
  id: text,
  name: text,
  phoneNumber: text,
  createdDate: nat64,
});

const Customer = Record({
  id: text,
  name: text,
  phoneNumber: text,
  createdDate: nat64,
})

const Reservation = Record({
  id: text,
  customerId: text,
  pickupLocation: text,
  destination: text,
  status: int8,
  price: float64,
  driverId: text,
  reservationDate: nat64,
});

const reservationStatus: { [key: number]: string } = {
  0: "Waiting",
  1: "Accepted",
  2: "On the Way",
  3: "Arrived",
  4: "Cancelled"
}

const customerStorage = StableBTreeMap(text, Customer, 0);
const driverStorage = StableBTreeMap(text, Driver, 0);
const reservationStorage = StableBTreeMap(text, Reservation, 0);

function isValidPhoneNumber(number: text): boolean {
  const regexExp = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return regexExp.test(number);
}

function driverInStorage(id: text){
  const driver = driverStorage.values();
  const queryDriver = driver.find(
    (driver: typeof Driver) =>
      driver.id === id
  );
  return queryDriver;
}

function reservationInStorage(id: text){
  const reservation = reservationStorage.values();
  const queryReservation = reservation.find(
    (reservation: typeof Reservation) =>
      reservation.id === id
  );
  return queryReservation;
}

function driverInOrder(id: text){
  const reservation = reservationStorage.values();
  const queryReservation = reservation.find(
    (reservation: typeof Reservation) =>
      (reservation.id === id && (reservation.status === 1 || reservation.status === 2))
  );
  return queryReservation;
}

export default Canister({
  registerCustomer: update([text, text], Result(text, text), (name, phoneNumber) => {
    if (!isValidPhoneNumber(phoneNumber)){
      return Result.Err('Number phone is not valid!');
    }
    const cust = {
      id: uuidv4(),
      name: name,
      phoneNumber: phoneNumber,
      createdDate: ic.time()
    }
    customerStorage.insert(cust.id, cust);
    return Result.Ok(cust.id);
  }),

  registerDriver: update([text, text], Result(text, text), (name, phoneNumber) => {
    if (!isValidPhoneNumber(phoneNumber)){
      return Result.Err('Number phone is not valid!');
    }
    const driver = {
      id: uuidv4(),
      name: name,
      phoneNumber: phoneNumber,
      createdDate: ic.time()
    }
    driverStorage.insert(driver.id, driver);
    return Result.Ok(driver.id);
  }),

  createReservation: update([text, text, text], Result(text, text), (customerId, pickupLocation, destination) => {
    const customer = customerStorage.values().find((c: typeof Customer) => c.id === customerId);
    if (!customer){
      return Result.Err('Customer is not registered');
    }
    const reservation = {
      id: uuidv4(),
      customerId: customerId,
      pickupLocation: pickupLocation,
      destination: destination,
      status: 0,
      price: 0,
      driverId: "",
      reservationDate: ic.time()
    }
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Transaction with ID ${reservation.id} was created successfully`);
  }),

  userGetReservationById: query([text, text], Result(Reservation, text), (customerId, reservationId) => {
    const reservation = reservationStorage.values();
    const queryReservation = reservation.find(
      (reservation: typeof Reservation) => 
        reservation.id === reservationId && reservation.customerId === customerId
    );
    if (!queryReservation){
      return Result.Err(`Transaction not found!`)
    }
    return Result.Ok(queryReservation);
  }),

  userGetAllReservation: query([text], Result(Vec(Reservation), text), (customerId) => {
    const customer = customerStorage.values();
    const queryCustomer = customer.find(
      (customer: typeof Customer) =>
        customer.id === customerId
    );
    if (!queryCustomer){
      return Result.Err(`Customer not found!`);
    }
    const reservation = reservationStorage.values();
    const queryReservation = reservation.filter(
      (reservation: typeof Reservation) => 
        reservation.customerId === customerId
    );
    if (!queryReservation){
      return Result.Err(`Transaction not found!`)
    }
    return Result.Ok(queryReservation);
  }),

  driverGetAllReservation: query([text], Result(Vec(Reservation), text), (driverId) => {
    const driver = driverStorage.values();
    const queryDriver = driver.find(
      (driver: typeof Driver) =>
        driver.id === driverId
    );
    if (!queryDriver){
      return Result.Err(`Customer not found!`);
    }
    const reservation = reservationStorage.values();
    const queryReservation = reservation.filter(
      (reservation: typeof Reservation) => 
        reservation.customerId === driverId
    );
    if (!queryReservation){
      return Result.Err(`Transaction not found!`)
    }
    return Result.Ok(queryReservation);
  }),

  driverGetWaitingReservation: query([text], Result(Vec(Reservation), text), (id) => {
    if (!driverInStorage(id)){
      return Result.Err(`Driver not found!`);
    }
    const reservation = reservationStorage.values();
    const queryReservation = reservation.filter(
      (reservation: typeof Reservation) => 
        reservation.status === 0
    );
    if (!queryReservation){
      return Result.Err(`Transaction not found!`)
    }
    return Result.Ok(queryReservation);
  }),

  driverTakeReservation: update([text, text], Result(text, text), (driverId, transactionId) => {
    if (!driverInStorage(driverId)){
      return Result.Err(`Driver not found!`);
    }
    const reservation = reservationInStorage(transactionId);
    if (!reservation){
      return Result.Err(`Reservation not found!`);
    }
    if (driverInOrder(driverId)){
      return Result.Err(`Driver Already In Order!`);
    }
    if (reservation.status != 0){
      return Result.Err(`Reservation status is ${reservationStatus[reservation.status]}`);
    }
    reservation.status = 1;
    reservation.driverId = driverId;
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Reservation with ID ${transactionId} is taken by Driver with ID ${driverId}`);
  }),

  driverOnTheWay: update([text, text], Result(text, text), (driverId, transactionId) => {
    if (!driverInStorage(driverId)){
      return Result.Err(`Driver not found!`);
    }
    const reservation = reservationInStorage(transactionId);
    if (!reservation || reservation.driverId != driverId){
      return Result.Err(`Reservation not found!`);
    }
    if (reservation.status != 1){
      return Result.Err(`Reservation status is ${reservationStatus[reservation.status]}`);
    }
    reservation.status = 2;
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Reservation with ID ${transactionId} is on the way`);
  }),

  driverArrived: update([text, text, float64], Result(text, text), (driverId, transactionId, price) => {
    if (!driverInStorage(driverId)){
      return Result.Err(`Driver not found!`);
    }
    const reservation = reservationInStorage(transactionId);
    if (!reservation || reservation.driverId != driverId){
      return Result.Err(`Reservation not found!`);
    }
    if (reservation.status != 2){
      return Result.Err(`Reservation status is ${reservationStatus[reservation.status]}`);
    }
    reservation.status = 3;
    reservation.price = price;
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Reservation with ID ${transactionId} is on the way`);
  }),

  driverCancel: update([text, text], Result(text, text), (driverId, transactionId) => {
    if (!driverInStorage(driverId)){
      return Result.Err(`Driver not found!`);
    }
    const reservation = reservationInStorage(transactionId);
    if (!reservation || reservation.driverId != driverId){
      return Result.Err(`Reservation not found!`);
    }
    if (reservation.status != 0){
      return Result.Err(`Reservation status is ${reservationStatus[reservation.status]}`);
    }
    reservation.status = 4;
    reservationStorage.insert(reservation.id, reservation);
    return Result.Ok(`Reservation with ID ${transactionId} was canceled`);
  })
});

globalThis.crypto = {
  // @ts-ignore
 getRandomValues: () => {
     let array = new Uint8Array(32);

     for (let i = 0; i < array.length; i++) {
         array[i] = Math.floor(Math.random() * 256);
     }

     return array;
 }
};