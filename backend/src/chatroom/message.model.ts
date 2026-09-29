import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasOne,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from 'src/user/user.model';
import { Chatroom } from './chatroom.model';
import { Block } from 'src/blockchain/block.model';

@Table({ tableName: 'Message', timestamps: true })
export class Message extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  content: string;

  @Column({ type: DataType.STRING, allowNull: true })
  imageUrl: string;

  @Column({ type: DataType.STRING, allowNull: true })
  blockHash: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @ForeignKey(() => Chatroom)
  @Column({ type: DataType.INTEGER, allowNull: false })
  chatroomId: number;

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'user' })
  user: User;

  @BelongsTo(() => Chatroom, { foreignKey: 'chatroomId', as: 'chatroom' })
  chatroom: Chatroom;

  @HasOne(() => Block, { foreignKey: 'messageId', as: 'block' })
  block: Block;
}
