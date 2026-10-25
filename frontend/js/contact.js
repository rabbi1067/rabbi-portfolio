/* Public EmailJS identifiers are editable content; OAuth secrets never belong here. */
const contactSettings = JSON.parse(document.getElementById('contact-settings').textContent);
const contactForm = document.getElementById('contact-form');
contactForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (contactForm.getAttribute('aria-busy') === 'true') return;
  const button = contactForm.querySelector('.form-submit');
  const status = document.getElementById('contact-status');
  const { form, emailjs: config } = contactSettings;
  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = false;
  };
  contactForm.setAttribute('aria-busy', 'true');
  button.disabled = true;
  button.textContent = form.sending_label;
  showStatus(form.sending_label, 'sending');
  try {
    if (!window.emailjs) throw new Error('EmailJS did not load');
    window.emailjs.init({ publicKey: config.public_key });
    await window.emailjs.sendForm(config.service_id, config.template_id, contactForm);
    showStatus(form.success_message, 'success');
    contactForm.reset();
  } catch (error) {
    console.error('EmailJS Error:', error);
    showStatus(form.error_message, 'error');
  } finally {
    contactForm.setAttribute('aria-busy', 'false');
    button.disabled = false;
    button.textContent = form.submit_label;
  }
});
