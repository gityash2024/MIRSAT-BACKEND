import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../../src/utils/permissions';
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  department?: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdBy?: Schema.Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'manager', 'inspector','user'],
      default: 'inspector',
    },
    department: {
      type: String,
      enum: ['Field Operations', 'Operations Management', 'Administration'],
    },
    permissions: [{
        type: String,
        enum: Object.values(PERMISSIONS).flatMap(group => Object.values(group))
      }],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    }
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

export const User = mongoose.model<IUser>('User', userSchema);