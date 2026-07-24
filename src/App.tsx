import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import ExerciseDetail from './routes/ExerciseDetail';
import ExerciseList from './routes/ExerciseList';
import Settings from './routes/Settings';

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={ExerciseList} />
        <Route path="/exercise/:id" component={ExerciseDetail} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="screen">
            <p className="empty">This page doesn't exist.</p>
          </div>
        </Route>
      </Switch>
    </Router>
  );
}
