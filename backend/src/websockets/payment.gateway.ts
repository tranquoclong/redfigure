// import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
// import { Server } from 'socket.io'
// // import { generateRoomUserId } from 'src/shared/helpers'

// export const generateRoomUserId = (userId: number) => {
//     return `userId-${userId}`
// }

// @WebSocketGateway({ namespace: 'payment' })
// export class PaymentGateway {
//     @WebSocketServer()
//     server: Server

//     @SubscribeMessage('send-money')
//     handleEvent(@MessageBody() data: string): string {
//         this.server.emit('receive-money', {
//             data: `Money: ${data}`,
//         })
//         return data
//     }

//     emitPaymentSuccess(userId: number): void {
//         this.server.to(generateRoomUserId(userId)).emit('payment', {
//             status: 'success',
//         })
//     }
// }
