/* globals m, b */
const h = m
const css = b

css.setDebug(true)
css.css('body', `
  margin: 0px;
`)

function sql(strings, ...values){
  return m.request({
    method: 'POST',
    url: '/sql',
    body: {
      sql: strings.join('?'),
      values
    }
  })
  .catch( 
    e => {
      return Promise.reject(
        'response' in e
        && 'message' in e.response
          ? new Error(e.response.message)
          : e
      )
    }
  )
}

let Y = {
  Verifying: value => (
    { tag: 'Verifying'
    , value
    }
  )
  
  ,
  Verified: value => (
    { tag: 'Verified'
    , value
    }
  )
  
  ,
  NotFound: () => 
    ({ tag: 'NotFound' })
  
  ,
  Unset: () =>
    ({ tag: 'Unset' })
}

// try to keep sql usage here to make it easier to 
// migrate later
const api = {
  async getExperiment({ id }){
    return sql`
      select * from experiments where id = ${id};
    `
  }
  
  , async getExperiments({ session_id }){
    const [session] = await api.verifySession(session_id)
    
    if( session.admin ) {
      return sql`
        select * from experiments
        where created_at is not null
        and deleted_at is null
        ;
      `
    } else {
      return []
    }
  }
  
  /*
    Hello wow
  */
  
  // cool wow
  
  , async createExperiment({ session_id }){
    const [session] = await api.verifySession(session_id)
    
    if( session.admin ) {
      const id = uuid.v4()
      await sql`
        insert into experiments
          ( id
          , created_at
          )

          values 
          ( ${id}
          , ${Date.now()}
          )
      `
      return sql`
        select * 
        from experiments
        where id = ${id}
      `
    } else {
      return []
    }
  }
  
  , async login({ username, password }){
    const xs = await sql`
      select U.id, U.username, A.id is not null as admin
      from users U
      left join admins A on A.user_id = U.id
      where true
      and username = ${username}
      and password = ${md5(password)}
    `

    if( xs.length == 0 ) {
      return Promise.reject({ message: 'Incorrect username/passowrd.' })
    } else {
      const [user] = xs
      await sql`
        insert into sessions
          ( id
          , user_id
          , created_at
          )

        values (
          ${ uuid.v4() }
          , ${ user.id }
          , ${ Date.now() }
        )
        ;
      `
      
      return sql`
        select S.*, A.id is not null as admin 
        from sessions S
        left join admins A using(user_id)
        where user_id = ${user.id}
        order by created_at desc
        limit 1
      `
    }
  }
  , async verifySession(id){
     return sql`
        select S.*, A.id is not null as admin 
        from sessions S
        left join admins A using(user_id)
        where S.id = ${id}
        order by created_at desc
        limit 1
      `
  }

}

async function flushDB(){
  await sql`drop table if exists experiments;`
  await sql`create table experiments(id);`
  await sql`
    insert into experiments (id) values ('hello');
  `
  await sql`drop table if exists sessions;`
  await sql`
    create table sessions
      ( id
      , user_id
      , created_at
      , updated_at
      , deleted_at
      )
    ;
  `
  
  await sql`drop table if exists experiments;`
  await sql`
    create table experiments
      ( id
      , created_at
      , started_at
      , updated_at
      , completed_at
      , deleted_at
      )
    ;
  `
  
  await sql`drop table if exists users;`
  await sql`
    create table users
      ( id
      , username
      , password
      , created_at
      , updated_at
      , deleted_at
      )
    ;
  `
  
  await sql`drop table if exists admins;`
  await sql`
    create table admins
      ( id
      , user_id
      , created_at
      , updated_at
      , deleted_at
      )
    ;
  `
  
  await sql`
    insert into users
      ( id
      , username
      , password
      , created_at
      , updated_at
      )
    select 
      ${uuid.v4()} as id
      , 'Admin' as username
      , ${md5('password')} as password
      , ${Date.now()} as created_at
      , ${Date.now()} as updated_at
  `
  
  await sql`
    insert into admins
      ( id
      , user_id
      , created_at
      , updated_at
      )
    select 
      ${uuid.v4()} as id
      , id as user_id
      , ${Date.now()} as created_at
      , ${Date.now()} as updated_at

    from users
    where username = 'Admin'
  `
}

const uuid = {
  v4(){
    return Math.random().toString(15).slice(3)
  }
}

function md5(x){
  return x
}

function initialState(){
  return {
    adminEmail: 'coolguy93@hotmail.com',
    experiment: Y.Unset(),
    experiments: Y.Unset(),
    user: Y.Unset(),
    route: window.location.pathname
  }
}

const update = m.stream()
const state = m.stream.scan(
  (p,f) => {
    const out = f(p)
    if( out != null ){
      return out
    } else {
      return p
    }
  }
  , 
  initialState()
  , update
)

let $ = {}
$.prop = k => f => x => ({
  ...x, [k]: f(x[k])
})
$.experiments = $.prop('experiments')
$.experiment = $.prop('experiment')
$.form = $.prop('form')
$.user = $.prop('user')


const assistance = () =>
  h('p', 'Please contact an adminstrator at '
    , m('a', { href: 'mailto:'+state().adminEmail }, state().adminEmail )
    , ' for assistance'
  )

function Info(){
  const view = () =>
    h('.route'
      , h('h1', 'Welcome to the <blah blah blah> Experiment') 
      , h('h4', 'To join the experiment you will need to receive an invite link.')
      , assistance()
      , m(m.route.Link, { href: '/access/login' }, 'Admin Login')
    )
  return { view }
}

function AdminLogin(){
  
  async function onsubmit(e){
    e.preventDefault()
    try {
      const [session] = await api.login(state().form)
      update( $.user( () => Y.Verified(session) ) )
    } catch (e) {
      console.error(e)
    }
  }
  
  update($.form(() => ({ username: 'Admin', password: 'password' })))
  
  const view = () =>
    h('.route'
      + css`
          display: grid;
          justify-content: center;
          grid-template-columns: minmax(20em, 10em);
          align-content: center;
          height: 100vh;
      `
      , h('h1', 'Admin Login')
      , h('form'
        + css`
          display: grid;
          gap: 1em;
        `
        .$nest('label', css`
          display: grid;
          gap: 1em;
        `)
        ,
        { onsubmit
        , oninput: e => 
           update( $.form( x => ({ ...x, [e.target.name]: e.target.value }) ))
        }
        , h('label'
          , h('span','Username: ')
          , h('input[name=username]')   
        )
        , h('label'
          , h('span','Password: ')
          , h('input[type=password][name=password]')   
        )
        , h('button[type=submit]', 'Submit')
      )
    )

  return { view }
}

const formatDate = x =>
  new Date(x).toLocaleString()

function AdminExperiments(){
  const view = () => 
    h('.route'
      + css`
        display: grid;
        gap: 1em;
        justify-content: start;
      `
      , h('h1', 'Admin Experiments')  // <h1>Admin Experiments</h1>
      , (
        state().experiments.tag == 'Verifying'
          ? 'Loading'
        : state().experiments.tag == 'Verified'
          ? (
            state().experiments.value.length == 0
            ? 'There are no experiments yet'
            : state().experiments.value.map(
              x =>
                h('.experiment'
                  , h('.id', x.id)
                  , h('.created', formatDate(x.created_at) )
                  , h('.status'
                      ,(
                        x.started_at
                          ? 'Started at ' + formatDate(x.updated_at)
                        : x.updated_at
                          ? 'Updated at ' + formatDate(x.updated_at)
                        : x.completed_at
                          ? 'Completed at ' + formatDate(x.updated_at)
                        : x.deleted_at
                          ? 'Deleted at ' + formatDate(x.updated_at)
                          : 'Not Started Yet.'
                      )
                  )
                  , h('button.view'
                     , 
                     { onclick: () => {
                       logout()
                       m.route.set('/experiment/'+x.id)
                     }
                     }
                     , 'View'
                  )
                )
            )
          )
          : null
      )
      , h('button'
          , 
          { onclick: async () => {
            const [experiment] = 
              await api.createExperiment({ session_id: state().user.value.id })
            
            if( experiment ) {
              update($.experiments( xs => experiment.concat(xs) ))
            }
          }
          }
          , 'Create New Experiment'
      )
      , h('button'
          , 
          { onclick: async e => {
            const el = e.currentTarget
            el.setAttribute('disabled', '')
            await flushDB()
            el.removeAttribute('disabled')
          }
          }
          , 'Flush Schema'
      )
     , h('button'
          , 
          { onclick: async () => {
            logout()
            m.route.set('/access/login')
          }
          }
          , 'Log Out'
      )
  
    )
  return { view }
}

function Experiment({ attrs: { id } }){
  
  update( $.experiment( () => Y.Verifying() ) )
  
  api.getExperiment({ id })
    .then(
      xs => {
        update( $.experiment( () => 
          xs.length == 0
            ? Y.NotFound()
            : Y.Verified(xs[0])
        ))
      }
      , console.error
    )
  
  
  const view = () => 
    h('.route'
      , h('h1', 'Experiment') 
      , h('pre', JSON.stringify(state(), null, 2))   
      , h(h.route.Link, { href: '/access/login' }, 'Login')
    )
  
  return { view }
}

function ExperimentErrorMessage({ attrs: { message }}){
  
  const view = () => 
    h('.route'
      , h('h1', 'Sorry there was an error accessing the experiment.')
      , h('h4', message )
      , assistance()
    )

  return { view }
}

function ReceiveInvite({ attrs: { id }}){
  
  api.verifySession(id)
  const view = () =>
    h('.route', 'Receive Invite')
  
  return { view }
}

function Verifying(){
  const view = () =>
    h('.route')
  
  return { view }
}

const oldGet = m.route.get
m.route.get = () => oldGet() || ''

const oldSet = m.route.set
m.route.set = (newRoute) => {
  const out = oldSet(newRoute)
  state().route = newRoute
  return out
}
m.route.prefix = ''
h.route(document.body, '/verifying', {
  '/info': Info,
  '/verifying': Verifying,
  '/access/login': AdminLogin,
  '/admin/experiments': AdminExperiments,
  '/invites/:token': ReceiveInvite,
  '/experiment/:id': Experiment,
  '/experiment/error/:message': ExperimentErrorMessage,
})

m.stream.scan(
  (p,n) => {
    try {
      routeService(p, n)
      errorService(p, n)
      sessionService(p, n)
      experimentsService(p, n)
    } catch (e) {
      console.error(e)
    }
    m.redraw() 
    return n
  }
  , state()
  , state
)


function routeService(p, n){
  n.route = window.location.pathname
}


function errorService(p, n){
  if( p.experiment != n.experiment && n.experiment.tag == 'NotFound' ){
    m.route.set('/experiment/error/ExperimentNotFound')
  }
}

function logout(){
  delete localStorage.user
  update(
    currentState => {
      return { 
        ...currentState
        , experiments: Y.Unset()
        , experiment: Y.Unset()
        , user: Y.Unset()
      }
    }
  )
}

async function sessionService(p, n){
  if( p.user != n.user || p.route != n.route ){
    if( n.user.tag == 'Verified' ) {
      localStorage.user = n.user.value.id
      if( n.user.value.admin ) {
        m.route.set('/admin/experiments')
      } else {
        m.route.set('/info')
      }
    } else if ( n.user.tag == 'Verifying' ) {
      const [user] = await api.verifySession(n.user.value)
      update(
        $.user(
          () => user ? Y.Verified(user) : Y.NotFound()
        )
      )
    } else if ( n.user.tag == 'NotFound' ) {
      if( state().route.includes('/admin') ) {
        m.route.set('/access/login')
      } else if ( state().route.includes('/verifying') ) {
        m.route.set('/info')
      }
      logout()
    }
  } else if ( n.user.tag == 'Unset' ) {
    await Promise.resolve()
    update(
      $.user(
        () => localStorage.user
          ? Y.Verifying(localStorage.user)
          : Y.NotFound()
      )
    )
  }
}

async function experimentsService(p, n){
  if( p.user != n.user){
    if( n.user.tag == 'Verified' && n.experiments.tag == 'Unset' ) {
      await Promise.resolve()
      update( $.experiments( () => Y.Verifying() ) )
      const xs = await api.getExperiments({ session_id: n.user.value.id })
      update( $.experiments( () => Y.Verified(xs) ) )
    }
  }
}