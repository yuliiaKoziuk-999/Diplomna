import {
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { Chatroom } from 'src/chatroom/chatroom.model';
import { Message } from 'src/chatroom/message.model';
import { ChatroomUsersJoin } from 'src/chatroom/chatroom-users.model';

@Table({ tableName: 'User', timestamps: true })
export class User extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  fullname: string;

  @Column({ type: DataType.STRING, allowNull: true })
  avatarUrl: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  email: string;

  @Column({ type: DataType.DATE, allowNull: true })
  emailVerifiedAt: Date;

  @Column({ type: DataType.STRING, allowNull: false })
  password: string;

  @Column({ type: DataType.STRING, allowNull: true })
  rememberToken: string;

  @BelongsToMany(() => Chatroom, {
    through: () => ChatroomUsersJoin,
    foreignKey: 'B',
    otherKey: 'A',
    as: 'chatrooms',
  })
  chatrooms: Chatroom[];

  @HasMany(() => Message, { foreignKey: 'userId', as: 'messages' })
  messages: Message[];
}
