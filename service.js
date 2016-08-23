import Ember from 'ember';
import Dropbox from 'dropbox-sdk';
import ENV from 'ember-contiq/config/environment';

var ArrayPromiseProxy = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);

export default Ember.Service.extend(Ember.Evented, {
  token: undefined,
  init(){
    this.callback = event => {
      if(event.data && event.data.type === 'dropbox-token'){
        Ember.run(this, 'onToken', event.data.data);
      }
    };
    window.addEventListener('message', this.callback);
  },
  willDestroy(){
    window.removeEventListener('message', this.callback);
  },
  onToken(data){
    if(data.access_token){
      this.set('token', data.access_token);
      this.trigger('tokenOk');
    } else {
      this.trigger('tokenError');
    }

    this.window.close();
  },
  authenticate(){
    if(this.get('token')){
      return Ember.RSVP.resolve();
    }
    let dbx = new Dropbox({ clientId: ENV.DROPBOX_CLIENT_ID });
    let url = (location.hostname === 'localhost' ? 'http' : 'https') + '://' + location.host + '/dropbox.html';
    let authUrl = dbx.getAuthenticationUrl(url);
    this.window = window.open(authUrl, 'dropbox', 'width=600,height=600');

    return new Ember.RSVP.Promise((resolve, reject) => {
      let timer;
      let service = this;
      function onError() {
        service.off('tokenOk', onOk);
        service.off('tokenError', onError);
        clearTimeout(timer);
        reject();
      }
      function onOk() {
        service.off('tokenOk', onOk);
        service.off('tokenError', onError);
        clearTimeout(timer);
        resolve();
      }

      timer = setTimeout(() => Ember.run(onError), 60000);
      service.on('tokenOk', onOk);
      service.on('tokenError', onError);
    });
  },
  getFolders(path = ''){
    let token = this.get('token');
    if(!token){
      return [];
    }
    var dbx = new Dropbox({ accessToken: token });
    let promise = new Ember.RSVP.Promise(function (resolve, reject) {
      dbx.filesListFolder({path})
         .then(
           (response) => resolve(response.entries.filter(item => item['.tag'] === 'folder')),
           reject
         );
    });
    return ArrayPromiseProxy.create({ promise });
  }
});
