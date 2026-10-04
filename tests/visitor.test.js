jest.mock('../src/config/db', () => ({
  getClient: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../src/repositories/visitor.repository', () => ({
  findQRByToken: jest.fn(),
  findPassByIdForComplex: jest.fn(),
  checkInVisitor: jest.fn(),
  incrementQRScan: jest.fn(),
  cancelPass: jest.fn(),
}));

jest.mock('../src/services/notification.service', () => ({ notifyMany: jest.fn() }));

const { getClient } = require('../src/config/db');
const visitorRepo = require('../src/repositories/visitor.repository');
const visitorService = require('../src/services/visitor.service');

const makeClient = () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
});

describe('Visitor QR authorization and transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects security users without a complex before opening a transaction', async () => {
    await expect(visitorService.verifyVisitorQR('token', 'security', null))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(getClient).not.toHaveBeenCalled();
  });

  it('locks the QR and pass, then checks in and increments the scan in one transaction', async () => {
    const client = makeClient();
    getClient.mockResolvedValueOnce(client);
    const complexId = '0e88eb04-1eef-4bce-91f9-37c898018f3a';
    visitorRepo.findQRByToken.mockResolvedValueOnce({
      id: 'qr-1', visitor_pass_id: 'pass-1', expires_at: new Date(Date.now() + 60_000), scanned_count: 0, max_scans: 1,
    });
    visitorRepo.findPassByIdForComplex.mockResolvedValueOnce({ id: 'pass-1', status: 'pending' });
    visitorRepo.checkInVisitor.mockResolvedValueOnce({ id: 'pass-1' });

    await expect(visitorService.verifyVisitorQR('token', 'security', complexId))
      .resolves.toEqual({ message: 'Visitor successfully checked in' });

    expect(client.query.mock.calls).toEqual([[ 'BEGIN' ], [ 'COMMIT' ]]);
    expect(visitorRepo.findQRByToken).toHaveBeenCalledWith(client, 'token');
    expect(visitorRepo.findPassByIdForComplex).toHaveBeenCalledWith(client, 'pass-1', complexId);
    expect(visitorRepo.checkInVisitor).toHaveBeenCalledWith(client, 'pass-1', complexId);
    expect(visitorRepo.incrementQRScan).toHaveBeenCalledWith(client, 'qr-1');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back an expired QR without attempting a check-in', async () => {
    const client = makeClient();
    getClient.mockResolvedValueOnce(client);
    visitorRepo.findQRByToken.mockResolvedValueOnce({
      id: 'qr-1', visitor_pass_id: 'pass-1', expires_at: new Date(Date.now() - 60_000), scanned_count: 0, max_scans: 1,
    });

    await expect(visitorService.verifyVisitorQR('token', 'admin', '0e88eb04-1eef-4bce-91f9-37c898018f3a'))
      .rejects.toMatchObject({ statusCode: 400, message: 'QR Code has expired' });

    expect(client.query.mock.calls).toEqual([[ 'BEGIN' ], [ 'ROLLBACK' ]]);
    expect(visitorRepo.findPassByIdForComplex).not.toHaveBeenCalled();
    expect(visitorRepo.checkInVisitor).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects an unassigned apartment admin from cancelling passes', async () => {
    await expect(visitorService.cancel('pass-1', 'admin-1', 'admin', null))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(visitorRepo.cancelPass).not.toHaveBeenCalled();
  });
});
