import { sendEmail } from './index';
import { accountActivationTemplate } from './templates/accountActivation';

export class SendEmail {

    async sendAccountActivationEmail(name: string, email: string, activationLink: string) {
        const html = accountActivationTemplate(name, activationLink);

        const success = await sendEmail({
            to: email,
            subject: 'Activate Your Account',
            html
        });

        return success ? { status: 'ok' } : { status: 'error' };
    }
}

