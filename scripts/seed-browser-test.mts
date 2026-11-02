import mongoose from 'mongoose';
import {User} from '../src/models/User';
import {hashPassword} from '../src/libs/passwordAuth';
await mongoose.connect('mongodb://127.0.0.1:27119/feedsync_mvp_browser');
await User.updateOne({email:'mvp-test@example.invalid'},{$set:{passwordHash:await hashPassword('LocalTest-Only-9384!')}},{upsert:true});
await mongoose.disconnect();
