import { DistanceGap, SonarRings } from '../components/Sonar'
import { Screen, TopBar } from '../components/Screen'

/** Dev only. The check in visuals in each state, since the real ones need two phones. */
export default function Preview() {
  return (
    <Screen>
      <TopBar back="/canvas" title="Check in visuals" />
      <p className="caption-4 text-text-muted">Listening</p>
      <SonarRings label="Sound leaving the phone" />
      <p className="caption-4 text-text-muted">Pass at 28 cm</p>
      <DistanceGap cm={28} good />
      <p className="caption-4 text-text-muted">Too far at 74 cm</p>
      <DistanceGap cm={74} good={false} />
    </Screen>
  )
}
