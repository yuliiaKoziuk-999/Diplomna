import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Message } from 'src/chatroom/message.model';

@Table({ tableName: 'Block', timestamps: false })
export class Block extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false })
  index: number;

  @Column({ type: DataType.DATE, allowNull: false })
  timestamp: Date;

  @Column({ type: DataType.STRING, allowNull: false })
  previousHash: string;

  @Column({ type: DataType.STRING, allowNull: false })
  hash: string;

  @ForeignKey(() => Message)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  messageId: number;

  @BelongsTo(() => Message, { foreignKey: 'messageId', as: 'message' })
  message: Message;
}
