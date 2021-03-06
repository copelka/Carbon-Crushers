/* eslint-disable camelcase */
/*eslint global-require: "error"*/
/* eslint-disable @typescript-eslint/no-var-requires */
import { Request, Response } from 'express';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const passport = require('passport');
require('../passport.config.ts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');


const port = process.env.PORT || 8080;
const dist = path.resolve(__dirname, '..', 'client', 'dist');
const app = express();
const cloudinary = require('cloudinary');
require('./db/database.ts');
const { addUser, findUser, Users, Stats, getAllStats, addShower, getAllShowers, updateVision, Friends, Updates, Badges } = require('./db/database.ts');

const { WEATHERBIT_TOKEN, GEOLOCATION_TOKEN } = process.env;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(dist));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

app.use(session({
  secret: process.env.clientSecret,
  saveUninitialized: false,
  resave: true
}));
cloudinary.config({
  cloud_name: process.env.cloudName,
  api_key: process.env.cloudinaryAPI,
  api_secret: process.env.cloudinarySecret
});
passport.serializeUser((user: any, done: any) => {
  done(null, user);
});
passport.deserializeUser((user: any, done: any) => {
  done(null, user);
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] }), (req: Request, res: Response) => console.info('auth', res));

app.get('/auth/error', (req: Request, res: Response) => res.send('Unknown Error'));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }), (req: any, res: any) => {
    const { displayName, photos } = req.user;
    const { value } = photos[0];
    res.cookie('crushers', displayName);
    return addUser(displayName, value)
      .then(() => res.redirect('/'))
      .catch((err: string) => console.warn(err));
  });

// check if a user is logged in
app.get('/isLoggedin', (req: Request, res: Response) => {
  req.cookies.crushers ? res.send(true) : res.send(false);
});

// logout route
app.delete('/logout', (req: Request, res: Response) => {
  res.clearCookie('crushers');
  res.json(false);
});

app.get('/user', (req: Request, res: Response) => {
  findUser(req.cookies.crushers)
    .then((data) => res.json(data))
    .catch((err: string) => console.warn('this here', err));
});

app.post('/profilePic', (req: Request, res: Response) => {
  Users.update(
    {picture: req.body.picture},
    {where: { name: req.cookies.crushers}}
  )
    .then((data) => console.info(data))
    .catch((err: string) => console.warn(err));
});

app.get('/statsData', (req: Request, res: Response) => {
  return getAllStats(req.cookies.crushers)
    .then((data) => res.json(data))
    .catch((err: string) => console.warn(err));
});

app.post('/statsData', (req: Request, res: Response) => {
  const name = req.cookies.crushers;
  const { meat_dine, energy, water, recycling, mileage, total } = req.body;
  const newStats = new Stats({meat_dine, energy, water, recycling, mileage, total, name});
  newStats.save()
    .then((stuff) => console.info('stats saved', stuff))
    .catch((err:string) => console.warn(err));
});

app.post('/shower', (req: Request, res: Response) => {
  const name: string = req.cookies.crushers;
  const { time } = req.body;
  addShower(name, time)
    .then((data) => res.send(data))
    .catch((err: string) => console.warn(err));
});

app.get('/shower', (req: Request, res: Response) => {
  const name: string = req.cookies.crushers;
  getAllShowers(name)
    .then((data) => {
      const showerData = data.reduce((totalTime, curShower) => totalTime.time += curShower.time);
      const userShowerAvg: number = showerData / data.length;
      res.status(200).json(userShowerAvg);
    })
    .catch((err: string) => console.warn(err));
});

app.put('/vision', (req: Request, res: Response) => {
  const name: string = req.cookies.crushers;
  const { visionType } = req.body;
  updateVision(name, visionType)
    .then((data: string) => res.send(data))
    .catch((err: string) => console.warn(err));
});

app.post('/friends', (req: Request, res: Response) => {
  findUser(req.body.name)
    .then((data) => res.json(data))
    .catch((err: string) => console.warn(err));
});

app.get('/friendsData', async (req: Request, res: Response) => {
  Friends.findAll({ where: { userName: req.cookies.crushers } })
    .then(async (data) => {
      Promise.all(data.map(friend => {
        return Stats.findAll({where: {name: friend.dataValues.friendsName }});
      }))
        .then(arrOfAllResolvedItems => {
          const arr = [];
          arrOfAllResolvedItems.forEach((subArr: any) => { arr.push(subArr[subArr.length - 1]); });
          res.send(arr);
        });
    })
    .catch((err) => console.warn(err));
});

app.get('/weakestStat', (req: Request, res: Response) => {
  const user: string = req.cookies.crushers;
  getAllStats(user)
    .then((data) => {
      data = data[data.length - 1];
      const stats = {
        energy: data.energy,
        dining: data.meat_dine,
        mileage: data.mileage,
        recycling: data.recycling,
        water: data.water
      };
      const weakestStat = Object.entries(stats).sort((a, b) => a[1] - b[1])[0][0];
      res.json(weakestStat);
    })
    .catch((err: string) => console.warn(err));
});

app.post('/addFriends', (req: Request, res: Response) => {

  const {friendsName} = req.body;
  const userName = req.cookies.crushers;

  const friendRequest = new Updates({username: friendsName, requests: userName});
  friendRequest.save()
    .then(() => console.info('Request Sent'))
    .catch(err => console.warn(err));


});
app.post('/acceptFriends', (req: Request, res: Response) => {

  const {friendsName} = req.body;
  const userName = req.cookies.crushers;
  const newFriend = new Friends({ userName, friendsName });
  const friend2 = new Friends({
    userName: friendsName,
    friendsName: userName
  });
  friend2.save()
    .then(() => console.info('Friend Saved'))
    .catch(err => console.warn(err));


  newFriend.save()
    .then(() => console.info('Friend Saved'))
    .catch(err => console.warn(err));
  Updates.destroy({where: {
    username: userName,
    requests: friendsName
  }});

});
app.post('/removeFriends', (req: Request, res: Response) => {

  const {friendsName} = req.body;
  const userName = req.cookies.crushers;

  Friends.destroy({where: {
    userName: userName,
    friendsName: friendsName
  }});
  Friends.destroy({where: {
    userName: friendsName,
    friendsName: userName
  }});

});
app.post('/declineFriends', (req: Request, res: Response) => {

  const {friendsName} = req.body;
  const userName = req.cookies.crushers;

  Updates.destroy({where: {
    username: userName,
    requests: friendsName
  }});


});
app.get('/friendRequests', (req: Request, res: Response) => {
  Updates.findAll({where: {username: req.cookies.crushers }})
    .then((data) => res.json(data))
    .catch((err: string) => console.warn(err));
});

app.get('/weather', (req: Request, res: Response) => {
  const { latitude, longitude } = req.query;
  const url = `http://api.weatherbit.io/v2.0/current?lat=${latitude}&lon=${longitude}&key=${WEATHERBIT_TOKEN}`;

  return axios.get(url)
    .then(({ data }) => res.status(200).send(data))
    .catch(() => res.status(404));
});

app.post('/location', (req: Request, res: Response) => {
  const { ip } = req.body;
  const url = `http://api.ipstack.com/${ip}?access_key=${GEOLOCATION_TOKEN}`;

  return axios.get(url)
    .then(({ data }) => res.status(200).send(data))
    .catch(() => res.status(404));
});

app.post('/badges', (req: Request, res: Response) => {
  const user = req.cookies.crushers;
  const { badge, img } = req.body.params;
  console.info(badge, img);
  return Badges.findOrCreate({
    badge_url: img,
    badge: badge,
    where: {userName: user, badge: badge, badge_url: img}
  })
    .then(() => res.status(200))
    .catch(() => res.status(404));
});

app.get('/badges', (req: Request, res: Response) => {
  const user = req.cookies.crushers;
  Badges.findAll({where: { userName: user }})
    .then((data) => {
      console.info('this?', data);
      res.status(200).send(data);
    })
    .catch((err) => {
      console.warn(err);
      res.status(404);
    });
});

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(dist, 'index.html'));
});

app.listen(port, () => console.info('Server is listening on http://127.0.0.1:' + port));
