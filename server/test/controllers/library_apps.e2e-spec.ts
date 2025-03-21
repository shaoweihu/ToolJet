import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDB, createUser, createNestAppInstance, authenticateUser } from '../test.helper';

describe('library apps controller', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await clearDB();
  });

  beforeAll(async () => {
    app = await createNestAppInstance();
  });

  describe('POST /api/library_apps', () => {
    it('should be able to create app if user has app create permission or has instance user type', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const superAdminUserData = await createUser(app, {
        email: 'superadmin@tooljet.io',
        groups: ['all_users', 'admin'],
        userType: 'instance',
      });

      const organization = adminUserData.organization;
      const nonAdminUserData = await createUser(app, {
        email: 'developer@tooljet.io',
        groups: ['all_users'],
        organization,
      });

      let loggedUser = await authenticateUser(app);
      adminUserData['tokenCookie'] = loggedUser.tokenCookie;

      loggedUser = await authenticateUser(app, 'developer@tooljet.io');
      nonAdminUserData['tokenCookie'] = loggedUser.tokenCookie;

      loggedUser = await authenticateUser(
        app,
        superAdminUserData.user.email,
        'password',
        adminUserData.organization.id
      );
      superAdminUserData['tokenCookie'] = loggedUser.tokenCookie;

      let response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'github-contributors', appName: 'Github Contributors' })
        .set('tj-workspace-id', nonAdminUserData.user.defaultOrganizationId)
        .set('Cookie', nonAdminUserData['tokenCookie']);

      expect(response.statusCode).toBe(403);

      response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'github-contributors', appName: 'GitHub Contributor Leaderboard' })
        .set('tj-workspace-id', adminUserData.user.defaultOrganizationId)
        .set('Cookie', adminUserData['tokenCookie']);

      expect(response.statusCode).toBe(201);
      expect(response.body.app[0].name).toContain('GitHub Contributor Leaderboard');
    });

    it('should return error if template identifier is not found', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const loggedUser = await authenticateUser(app);
      adminUserData['tokenCookie'] = loggedUser.tokenCookie;

      const response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'non-existent-template', appName: 'Non existent template' })
        .set('tj-workspace-id', adminUserData.user.defaultOrganizationId)
        .set('Cookie', adminUserData['tokenCookie']);

      const { timestamp, ...restBody } = response.body;

      expect(timestamp).toBeDefined();
      expect(restBody).toEqual({
        message: 'App definition not found',
        path: '/api/library_apps',
        statusCode: 400,
      });
    });
  });

  describe('GET /api/library_apps', () => {
    it('should be get app manifests', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const superAdminUserData = await createUser(app, {
        email: 'superadmin@tooljet.io',
        groups: ['all_users', 'admin'],
        userType: 'instance',
      });

      let loggedUser = await authenticateUser(app);
      adminUserData['tokenCookie'] = loggedUser.tokenCookie;

      loggedUser = await authenticateUser(
        app,
        superAdminUserData.user.email,
        'password',
        adminUserData.organization.id
      );
      superAdminUserData['tokenCookie'] = loggedUser.tokenCookie;

      let response = await request(app.getHttpServer())
        .get('/api/library_apps')
        .set('tj-workspace-id', adminUserData.user.defaultOrganizationId)
        .set('Cookie', adminUserData['tokenCookie']);

      expect(response.statusCode).toBe(200);

      let templateAppIds = response.body['template_app_manifests'].map((manifest) => manifest.id);

      expect(new Set(templateAppIds)).toContain('github-contributors');
      expect(new Set(templateAppIds)).toContain('customer-dashboard');

      response = await request(app.getHttpServer())
        .get('/api/library_apps')
        .set('tj-workspace-id', adminUserData.user.defaultOrganizationId)
        .set('Cookie', superAdminUserData['tokenCookie']);

      expect(response.statusCode).toBe(200);

      templateAppIds = response.body['template_app_manifests'].map((manifest) => manifest.id);

      expect(new Set(templateAppIds)).toContain('github-contributors');
      expect(new Set(templateAppIds)).toContain('customer-dashboard');
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
