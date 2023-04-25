import { Hotel, TicketStatus, User } from '@prisma/client';
import httpStatus from 'http-status';
import supertest from 'supertest';
import { generateValidToken, cleanDb } from '../helpers';
import {
  createEnrollmentWithAddress,
  createHotel,
  createRoom,
  createTicket,
  createTicketType,
  createUser,
} from '../factories';
import describeRouteAuthentication from './common/route-authentication';
import app, { init } from '@/app';
import { HotelWithRooms } from '@/repositories/hotels-repository';

beforeAll(async () => await init());
beforeEach(async () => await cleanDb());

const server = supertest(app);

type TicketTypeConfigParam = Partial<{ isRemote: boolean; includesHotel: boolean; status: TicketStatus }>;

const defaultConfigParam = { isRemote: false, includesHotel: true, status: TicketStatus.PAID };

const createTicketContext = async (user: User, config: TicketTypeConfigParam = defaultConfigParam): Promise<void> => {
  const { isRemote = false, includesHotel = true, status = TicketStatus.PAID } = config;

  const { id: enrollmentId } = await createEnrollmentWithAddress(user);
  const { id: ticketTypeId } = await createTicketType({ isRemote, includesHotel });

  await createTicket(enrollmentId, ticketTypeId, status);
};

const createHotelAndRoom = async () => {
  const hotel = await createHotel();
  const room = await createRoom(hotel.id);
  return { hotel, room };
};

describe('GET /hotels', () => {
  describeRouteAuthentication('/hotels', 'get');

  describe('when token is valid', () => {
    it('should respond with status 404 if user has no ticket', async () => {
      const token = await generateValidToken();

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.NOT_FOUND);
    });

    it('should respond with status 402 if ticket is not paid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { status: TicketStatus.RESERVED });

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    it('should respond with status 402 if ticket is remote', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { isRemote: true });

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    it('should respond with status 402 if ticket does not includes hotel', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { includesHotel: false });

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    describe('when ticket is valid', () => {
      it('should respond with status 404 if there is no hotels', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        await createTicketContext(user);

        const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(httpStatus.NOT_FOUND);
      });

      it('should respond with status 200 and with a list of hotels', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        await createHotelAndRoom();
        await createTicketContext(user);

        const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(httpStatus.OK);
        expect(response.body).toEqual(expect.arrayContaining<Hotel>([]));
      });
    });
  });
});

describe('GET /hotels/:hotelId', () => {
  describeRouteAuthentication('/hotels/0', 'get');

  describe('when token is valid', () => {
    it('should respond with status 404 if user has no ticket', async () => {
      const token = await generateValidToken();

      const response = await server.get('/hotels/0').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.NOT_FOUND);
    });

    it('should respond with status 402 if ticket is not paid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { status: TicketStatus.RESERVED });

      const response = await server.get('/hotels/0').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    it('should respond with status 402 if ticket is remote', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { isRemote: true });

      const response = await server.get('/hotels/0').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    it('should respond with status 402 if ticket does not includes hotel', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      await createTicketContext(user, { includesHotel: false });

      const response = await server.get('/hotels/0').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.PAYMENT_REQUIRED);
    });

    describe('when ticket is valid', () => {
      it('should respond with status 400 if hotel id sent is invalid', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        await createTicketContext(user);

        const response = await server.get('/hotels/invalid-hotel-id').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(httpStatus.BAD_REQUEST);
      });

      it('should respond with status 404 if hotel does not exists', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        const { hotel } = await createHotelAndRoom();
        await createTicketContext(user);

        const response = await server.get(`/hotels/${hotel.id + 1}`).set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(httpStatus.NOT_FOUND);
      });

      it('should respond with status 200 and with a list of hotels with rooms', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        const { hotel } = await createHotelAndRoom();
        await createTicketContext(user);

        const response = await server.get(`/hotels/${hotel.id}`).set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(httpStatus.OK);
        expect(response.body).toEqual(expect.arrayContaining<HotelWithRooms>([]));
      });
    });
  });
});
