const Ticket = require("../../../models/Ticket");
const User = require("../../../models/User");
const Trip = require("../../../models/Trip");
const { sendBookingTicketEmail } = require("../../../services/email/sendBookingTicket");

module.exports.createTicket = (req, res, next) => {
  const { tripId, seatCodes } = req.body;
  const userId = req.user._id; //token
  console.log("module.exports.createTicket -> userId", userId);

  Trip.findById(tripId)
    .populate("fromStation")
    .populate("toStation")
    .then((trip) => {
      if (!trip) return Promise.reject({ status: 404, message: "Trip not found" });
      const availableSeatCodes = trip.seats.filter((s) => !s.isBooked).map((s) => s.code);
      let errorSeatCodes = [];

      seatCodes.forEach((code) => {
        if (availableSeatCodes.indexOf(code) === -1) errorSeatCodes.push(code);
      });

      if (errorSeatCodes.length > 0)
        return Promise.reject({
          status: 400,
          message: "Seats are not available",
          notAvailableSeats: errorSeatCodes,
        });

      const newTicket = new Ticket({
        tripId,
        userId,
        seats: seatCodes.map((s) => ({
          isBooked: true,
          code: s,
        })),
        totalPrice: trip.price * seatCodes.length,
      });
      trip.seats = trip.seats.map((s) => {
        if (seatCodes.indexOf(s.code) > -1) {
          s.isBooked = true;
        }
        return s;
      });
      return Promise.all([newTicket.save(), trip.save()]);
    })

    .then((result) => {
      sendBookingTicketEmail(result[0], result[1], req.user);
      res.status(200).json(result[0]);
    })
    .catch((err) => res.status(500).json(err));
};

module.exports.getTicket = async (req, res, next) => {
  try {
    await req.user
      .populate({
        path: "ticket",
        populate: {
          path: "tripId userId",
          select: "fromStation toStation startTime email fullName phoneNumber",
          populate: { path: "fromStation toStation" },
        },
      })
      .execPopulate();
    res.status(200).send(req.user.ticket);
  } catch (e) {
    res.status(500).send();
  }
};

/**
 * @todo: get ticket theo id có ngăn chặn người khác xem vé khi biết id vé
 */

module.exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .populate({
        path: "tripId",
        select: "fromStation toStation startTime",
        populate: { path: "fromStation toStation" },
      })
      .populate({ path: "userId", select: "email fullName phoneNumber" });

    if (!ticket) res.status(404).json({ message: "Can not find. Ticket not found" });
    res.status(200).send(ticket);
  } catch (e) {
    res.status(500).send();
  }
};

module.exports.deleteTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOneAndDelete({
      _id: req.params.id,
    });
    if (!ticket) return res.status(404).json({ message: "Can not delete. Ticket not found" });
    const trip = await Trip.findById(ticket.tripId);
    if (!trip) return res.status(406).json({ message: "Trip not found" });
    trip.seats.map((seat) => {
      ticket.seats.map((ticket) => {
        if (ticket.code === seat.code) {
          seat.isBooked = false;
        }
      });
    });
    await trip.save();
    return res.status(200).send({ message: "Delete ticket successfully", ticket });
  } catch (e) {
    res.status(500).send(e);
  }
};

module.exports.deleteTickets = async (req, res, next) => {
  try {
    await Ticket.findOneAndDelete({ userId: req.user._id });
    res.status(200).send({ message: "Delete all ticket successfully!" });
  } catch (e) {
    res.status(500).send(e);
  }
};

module.exports.getAllTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.find()
      .populate({
        path: "tripId",
        select: "fromStation toStation startTime price",
        populate: { path: "fromStation toStation" },
      })
      .populate({ path: "userId", select: "email fullName phoneNumber" });
    res.status(200).send({ list: ticket, message: "Get all ticket successfully!" });
  } catch (e) {
    res.status(500).send(e);
  }
};
