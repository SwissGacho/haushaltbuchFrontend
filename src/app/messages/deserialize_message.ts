import { Message, IncomingMessage, MessageType } from './Message'
import { HelloMessage,WelcomeMessage,ByeMessage } from './admin.messages'
import { NavigationHeaders, ObjectList, ObjectMessage, ObjectSchemaMessage } from './data.messages'
import { ObjectSetupMessage } from './setup.messages'

export class MessageFactory {

  static deserialize(event: MessageEvent): Message {
    let data = JSON.parse(event.data)
    console.log('Deserializing message', data)
    switch (data.type) {
      case MessageType.Object:
        return new ObjectMessage(data);
      case MessageType.ObjectSetup:
        return new ObjectSetupMessage(data);
      case MessageType.Hello:
        return new HelloMessage(data);
      case MessageType.Welcome:
        return new WelcomeMessage(data);
      case MessageType.Bye:
        return new ByeMessage(data);
      case MessageType.NavigationHeaders:
        return new NavigationHeaders(data);
      case MessageType.ObjectList:
        return new ObjectList(data);
      case MessageType.ObjectSchema:
        return new ObjectSchemaMessage(data);
      default:
        return new IncomingMessage(data);
    }
  }
}
  
