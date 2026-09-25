require('react-native-gesture-handler/jestSetup');

// `lottie-react-native` is a native view. Tests only need something in its place, and the
// imperative API `Mascot` calls.
jest.mock('lottie-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  class LottieView extends React.Component {
    play() {}
    reset() {}
    pause() {}
    resume() {}
    render() {
      return React.createElement(View, { testID: 'lottie', style: this.props.style });
    }
  }
  return { __esModule: true, default: LottieView };
});
