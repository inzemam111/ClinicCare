import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CredentialsDto {
  @ApiProperty({ example: 'person@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class PatientRegistrationDto extends CredentialsDto {
  @ApiProperty()
  @IsUUID()
  clinicId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class DoctorRegistrationDto extends CredentialsDto {
  @ApiProperty()
  @IsUUID()
  clinicId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  registrationNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;
}

export class ReceptionistRegistrationDto extends CredentialsDto {
  @ApiProperty()
  @IsUUID()
  clinicId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  displayName!: string;
}

export class LoginDto extends CredentialsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsUUID()
  challengeId!: string;

  @ApiProperty()
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class PasswordRecoveryDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class PasswordResetDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
