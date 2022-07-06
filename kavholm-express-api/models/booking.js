const db = require("../db")
const { BadRequestError, NotFoundError } = require("../utils/errors")

class Booking {
  static async fetchBookingById(bookingId) {
    // fetch a single booking by its id
    const results = await db.query(
      `
      SELECT id,
             payment_method AS "paymentMethod",
             start_date AS "startDate",
             end_date AS "endDate",
             guests,
             total_cost AS "totalCost",
             listing_id AS "listingId",
             user_id AS "userId",
             -- subquery to select the username
             -- of the user who is making the booking
             (
               SELECT username
               FROM users
               WHERE id = user_id
             ) AS "username",
             -- nested subquery to select the username
             -- of the host user who owns the listing
             (
               SELECT users.username
               FROM users
               WHERE users.id = (
                 SELECT listings.user_id
                 FROM listings
                 WHERE listings.id = listing_id
               )
             ) AS "hostUsername",
             created_at AS "createdAt"
      FROM bookings
      WHERE id = $1;
      `,
      [bookingId]
    )

    const booking = results.rows[0]

    if (booking) return booking

    throw new NotFoundError("No booking found with that id.")
  }

  static async listBookingsFromUser(user) {
    // list all bookings that the user has created
    const results = await db.query(
      `
      SELECT bookings.id,
            bookings.payment_method AS "paymentMethod",
            bookings.start_date AS "startDate",
            bookings.end_date AS "endDate",
            bookings.guests,
            bookings.total_cost AS "totalCost",
            bookings.listing_id AS "listingId",
            bookings.user_id AS "userId",
            users.username AS "username",
            (
              SELECT hostUsers.username
              FROM users AS hostUsers
              WHERE hostUsers.id = (
                SELECT listings.user_id
                FROM listings
                WHERE listings.id = listing_id
              )
            ) AS "hostUsername",            
            bookings.created_at AS "createdAt"
      FROM bookings
        JOIN users ON users.id = bookings.user_id
      WHERE user_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY bookings.created_at DESC;
      `,
      [user.username]
    )

    return results.rows
  }

  static async listBookingsForUserListings(user) {
    // list all bookings created for any of the listings that a user owns
    const results = await db.query(
      `
      SELECT bookings.id,
             bookings.payment_method AS "paymentMethod",
             bookings.start_date AS "startDate",
             bookings.end_date AS "endDate",
             bookings.guests,
             bookings.total_cost AS "totalCost",
             bookings.listing_id AS "listingId",
             bookings.user_id AS "userId",
             users.username AS "username",
             (
              SELECT hostUsers.username
              FROM users AS hostUsers
              WHERE hostUsers.id = (
                SELECT listings.user_id
                FROM listings
                WHERE listings.id = listing_id
              )
             ) AS "hostUsername",
             bookings.created_at AS "createdAt"
      FROM bookings
        JOIN users ON users.id = bookings.user_id
        JOIN listings ON listings.id = bookings.listing_id
      WHERE listings.user_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY bookings.created_at DESC;
      `,
      [user.username]
    )

    return results.rows
  }

  static async createBooking({newBooking, listing, user}) {
    const requiredFields = ["startDate", "endDate"]
    //console.log("listing", listing)
    requiredFields.forEach((field) => {
      if (!newBooking?.hasOwnProperty(field)) {
        
        throw new BadRequestError(`Missing required field - ${field} - in request body.`)
      }
    })
    if(!user?.username){
      
      throw new BadRequestError(`Missing required field - username - in request body.`)
    }
    if(!listing?.userId || !listing?.price){
      
      throw new BadRequestError(`Missing required field - listing - in request body.`)
    }
    const startD = new Date(newBooking.startDate);//2022-01-10
    const endD = new Date(newBooking.endDate);
    const nightPrice = parseInt(listing.price)*1.1;
    const totalPrice = (((endD - startD)/86400000)+1)*nightPrice;
    console.log("type", typeof(totalPrice));
    const results = await db.query(
      `
        INSERT INTO bookings (payment_method, start_date, end_date, guests, total_cost, listing_id, user_id)
        VALUES ($1, ($2)::date, ($3)::date, $4, CEIL($7) , $5, (SELECT id FROM users WHERE users.username = $6))
        RETURNING id,
                  payment_method AS "paymentMethod",
                  user_id AS "userId",
                  $6 AS "username",
                  start_date AS "startDate",
                  end_date AS "endDate",
                  guests,
                  listing_id AS "listingId",
                  total_cost::DECIMAL AS "totalCost",
                  (SELECT username FROM users WHERE users.id = $8) AS "hostUsername",
                  created_at AS "createdAt";
      `,
      [
        newBooking?.paymentMethod || "card",
        newBooking.startDate,
        newBooking.endDate,
        newBooking?.guests || 1,
        listing.id,
        user.username,
        totalPrice,
        listing.userId
      ]
    )

    return results.rows[0]
  }
}

module.exports = Booking
