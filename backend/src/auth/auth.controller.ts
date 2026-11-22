import { Body, Controller, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { AuthRateLimitGuard } from './rate-limit.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import {
  DoctorRegistrationDto,
  LoginDto,
  PasswordRecoveryDto,
  PasswordResetDto,
  PatientRegistrationDto,
  ReceptionistRegistrationDto,
  RefreshTokenDto,
  VerifyOtpDto,
} from './auth.dto';
const device = (ipAddress: string, userAgent?: string, deviceName?: string) => ({
  ipAddress,
  userAgent,
  deviceName,
});
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('register/patient')
  @ApiOperation({ summary: 'Register a patient account' })
  registerPatient(@Body() body: PatientRegistrationDto) {
    return this.auth.registerPatient(body);
  }
  @Public()
  @Post('register/doctor')
  @ApiOperation({ summary: 'Register a doctor in the current clinic' })
  registerDoctor(@Body() body: DoctorRegistrationDto) {
    return this.auth.registerDoctor(body);
  }
  @ApiBearerAuth()
  @RequirePermissions(Permissions.STAFF_PERMISSION_MANAGE)
  @Post('staff/receptionist')
  @ApiOperation({ summary: 'Create a receptionist account' })
  createReceptionist(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ReceptionistRegistrationDto,
  ) {
    this.authorization.assertClinicScope(actor, body.clinicId);
    return this.auth.createReceptionist(body);
  }
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(@Body() body: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(body.email, body.password, device(ip, userAgent, body.deviceName));
  }
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('otp/verify')
  @ApiOperation({ summary: 'Complete a multi-factor login challenge' })
  verifyOtp(
    @Body() body: VerifyOtpDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.verifyOtp(body.challengeId, body.code, device(ip, userAgent, body.deviceName));
  }
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh and access tokens' })
  refresh(
    @Body() body: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.refresh(body.refreshToken, device(ip, userAgent, body.deviceName));
  }
  @ApiBearerAuth() @Post('logout') logout(@CurrentUser() actor: AuthenticatedUser) {
    return this.auth.logout(actor.sessionId);
  }
  @ApiBearerAuth()
  @Post('logout-all')
  logoutAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.auth.revokeAll(actor.id);
  }
  @Public() @UseGuards(AuthRateLimitGuard) @Post('password-recovery') passwordRecovery(
    @Body() body: PasswordRecoveryDto,
  ) {
    return this.auth.requestPasswordReset(body.email);
  }
  @Public() @UseGuards(AuthRateLimitGuard) @Post('password-reset') passwordReset(
    @Body() body: PasswordResetDto,
  ) {
    return this.auth.resetPassword(body.token, body.password);
  }
}
