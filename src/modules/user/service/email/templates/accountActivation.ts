export function accountActivationTemplate(name: string, activationLink: string) {
  return `
    <div style="font-family: Arial; max-width: 600px;">
      <h2>Welcome, ${name}!</h2>
      <p>Please activate your account by clicking below:</p>
      <a href="${activationLink}" style="background: #4CAF50; color: white; padding: 10px 15px; text-decoration: none;">Activate Account</a>
      <p>This link will expire in 24 hours.</p>
    </div>
  `;
}
