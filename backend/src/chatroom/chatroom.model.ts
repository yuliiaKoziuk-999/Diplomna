import {
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { BelongsToManyAddAssociationsMixin } from 'sequelize';
import { User } from 'src/user/user.model';
import { Message } from './message.model';
import { ChatroomUsersJoin } from './chatroom-users.model';

@Table({ tableName: 'Chatroom', timestamps: true })
export class Chatroom extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @BelongsToMany(() => User, {
    through: () => ChatroomUsersJoin,
    foreignKey: 'A',
    otherKey: 'B',
    as: 'users',
  })
  users: User[];

  declare addUsers: BelongsToManyAddAssociationsMixin<User, number>;

  @HasMany(() => Message, { foreignKey: 'chatroomId', as: 'messages' })
  messages: Message[];
}
