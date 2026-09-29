import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Chatroom } from './chatroom.model';
import { User } from 'src/user/user.model';

// Прихована join-таблиця для зв'язку many-to-many Chatroom <-> User.
// Відповідає імпліцитній таблиці "_ChatroomUsers", яку раніше керував Prisma.
@Table({ tableName: '_ChatroomUsers', timestamps: false })
export class ChatroomUsersJoin extends Model {
  @ForeignKey(() => Chatroom)
  @Column({ type: DataType.INTEGER })
  A: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER })
  B: number;
}
