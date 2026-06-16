// app/(tabs)/LMS.jsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import lmsService from "../../services/lms.service";

export default function LMS() {
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Quiz States
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [courseStarted, setCourseStarted] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState(null);

  useEffect(() => {
    loadUserAndCourses();
  }, []);

  const loadUserAndCourses = async () => {
    try {
      setLoading(true);
      
      // Get employee number first
      const empNumber = await getEmployeeNumber();
      setEmployeeNumber(empNumber);
      
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        await fetchCourses();
      } else {
        Alert.alert("Error", "Please login again");
      }
    } catch (error) {
      console.error("Error loading user:", error);
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeNumber = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.employeeNumber) {
          return user.employeeNumber;
        }
      }
      
      const empNumber = await AsyncStorage.getItem("employeeNumber");
      if (empNumber) {
        return empNumber;
      }
      
      throw new Error("Employee number not found");
    } catch (error) {
      console.error("Error getting employee number:", error);
      throw error;
    }
  };

  const fetchCourses = async () => {
    try {
      const result = await lmsService.getAllCourses();
      if (result.success && result.data) {
        setCourses(result.data);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  const startCourse = async (course) => {
    setQuizLoading(true);
    setSelectedCourse(course);
    setCourseStarted(true);
    
    try {
      // Fetch questions for the course
      const questionsResult = await lmsService.getCourseQuestions(course._id);
      if (questionsResult.success && questionsResult.data && questionsResult.data.length > 0) {
        setQuestions(questionsResult.data);
        
        // Start attempt with dynamic employee number
        const attemptResult = await lmsService.startAttempt(
          course._id,
          employeeNumber
        );
        
        if (attemptResult.success && attemptResult.data) {
          setAttemptId(attemptResult.data._id);
          setModalVisible(true);
          setCurrentQuestionIndex(0);
          setSelectedOption(null);
          setScore(0);
          setQuizCompleted(false);
        } else {
          Alert.alert("Error", "Failed to start course. Please try again.");
        }
      } else {
        Alert.alert("Info", "No questions available for this course yet.");
      }
    } catch (error) {
      console.error("Error starting course:", error);
      Alert.alert("Error", "Failed to load course content.");
    } finally {
      setQuizLoading(false);
      setCourseStarted(false);
    }
  };

  const handleOptionSelect = async (index) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = index === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    
    // Submit answer to API
    if (attemptId) {
      await lmsService.submitAnswer(attemptId, currentQuestion._id, index);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      // Submit final attempt
      setQuizLoading(true);
      const submitResult = await lmsService.submitAttempt(attemptId);
      if (submitResult.success && submitResult.data) {
        setResult(submitResult.data);
        setQuizCompleted(true);
      } else {
        Alert.alert("Error", "Failed to submit quiz. Please try again.");
      }
      setQuizLoading(false);
    }
  };

  const closeQuiz = () => {
    setModalVisible(false);
    setSelectedCourse(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setScore(0);
    setQuizCompleted(false);
    setAttemptId(null);
    setResult(null);
    setCourseStarted(false);
  };

  const getCourseProgress = () => {
    const totalCourses = courses.length;
    const completedCourses = courses.filter(c => c.completed).length;
    return totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D96A17" />
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.smallTitle}>LEARNING HUB</Text>
        <Text style={styles.title}>My Learning</Text>
        <Text style={styles.subtitle}>
          Complete courses and grow your retail skills.
        </Text>
        <Text style={styles.userName}>
          {user?.name || "Employee"} • {employeeNumber || "ID not found"}
        </Text>
      </View>

      <View style={styles.progressCard}>
        <View>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={styles.progressValue}>{getCourseProgress()}%</Text>
        </View>
        <View style={styles.circle}>
          <Ionicons name="school" size={34} color="#fff" />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{courses.length}</Text>
          <Text style={styles.statText}>Courses</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{courses.filter(c => c.completed).length}</Text>
          <Text style={styles.statText}>In Progress</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{courses.filter(c => c.passed).length}</Text>
          <Text style={styles.statText}>Completed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Available Courses</Text>

      {courses.map((course, index) => (
        <TouchableOpacity 
          key={course._id || index} 
          style={styles.courseCard}
          onPress={() => startCourse(course)}
          disabled={courseStarted}
        >
          <View style={styles.courseIcon}>
            <Ionicons name="book-outline" size={28} color="#ff7b00" />
          </View>

          <View style={styles.courseInfo}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseSubtitle} numberOfLines={2}>
              {course.description}
            </Text>
            <View style={styles.courseMeta}>
              <Text style={styles.passingInfo}>
                Passing: {course.passingPercentage}%
              </Text>
              <Text style={styles.questionCount}>
                {course.questionCount || "Multiple"} Questions
              </Text>
            </View>
          </View>

          <View style={styles.playButton}>
            {courseStarted && selectedCourse?._id === course._id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="play" size={20} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />

      {/* Quiz Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeQuiz}
      >
        <SafeAreaView style={styles.modalContainer}>
          {!quizCompleted && questions.length > 0 ? (
            // Active Quiz View
            <View style={styles.quizContainer}>
              <View style={styles.quizHeader}>
                <TouchableOpacity onPress={closeQuiz} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
                <Text style={styles.quizTitle}>{selectedCourse?.title}</Text>
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>
                    {currentQuestionIndex + 1}/{questions.length}
                  </Text>
                </View>
              </View>

              <ScrollView style={styles.quizContent}>
                <View style={styles.questionCard}>
                  <Text style={styles.questionNumber}>
                    Question {currentQuestionIndex + 1}
                  </Text>
                  <Text style={styles.questionText}>
                    {questions[currentQuestionIndex]?.question}
                  </Text>
                </View>

                <View style={styles.optionsGrid}>
                  {questions[currentQuestionIndex]?.options.map((option, idx) => {
                    let optionStyle = styles.optionCard;
                    let optionTextStyle = styles.optionCardText;
                    
                    if (selectedOption !== null) {
                      if (idx === questions[currentQuestionIndex].correctAnswer) {
                        optionStyle = [styles.optionCard, styles.correctOptionCard];
                        optionTextStyle = [styles.optionCardText, styles.correctOptionCardText];
                      } else if (idx === selectedOption) {
                        optionStyle = [styles.optionCard, styles.wrongOptionCard];
                        optionTextStyle = [styles.optionCardText, styles.wrongOptionCardText];
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={optionStyle}
                        onPress={() => handleOptionSelect(idx)}
                        disabled={selectedOption !== null}
                      >
                        <View style={styles.optionLetter}>
                          <Text style={styles.optionLetterText}>
                            {String.fromCharCode(65 + idx)}
                          </Text>
                        </View>
                        <Text style={optionTextStyle}>{option}</Text>
                        {selectedOption !== null && idx === questions[currentQuestionIndex].correctAnswer && (
                          <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                        )}
                        {selectedOption !== null && idx === selectedOption && idx !== questions[currentQuestionIndex].correctAnswer && (
                          <Ionicons name="close-circle" size={24} color="#C62828" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedOption !== null && (
                  <TouchableOpacity 
                    style={styles.nextButton} 
                    onPress={handleNext}
                    disabled={quizLoading}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentQuestionIndex === questions.length - 1 ? "Submit Quiz" : "Next Question"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          ) : (
            // Results View
            <View style={styles.resultContainer}>
              <View style={styles.resultCard}>
                <View style={styles.resultIcon}>
                  <Ionicons 
                    name={result?.passed ? "trophy" : "school"} 
                    size={60} 
                    color={result?.passed ? "#FFD700" : "#ff7b00"} 
                  />
                </View>
                
                <Text style={styles.resultTitle}>
                  {result?.passed ? "Congratulations!" : "Quiz Completed"}
                </Text>
                
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreLabel}>Your Score</Text>
                  <Text style={styles.scoreValue}>
                    {score} / {questions.length}
                  </Text>
                  <View style={styles.scoreProgress}>
                    <View 
                      style={[
                        styles.scoreProgressFill, 
                        { width: `${(score / questions.length) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.scorePercentage}>
                    {Math.round((score / questions.length) * 100)}%
                  </Text>
                </View>

                <View style={styles.resultDetails}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Status:</Text>
                    <Text style={[styles.resultValue, { color: result?.passed ? "#2E7D32" : "#C62828" }]}>
                      {result?.passed ? "PASSED" : "NOT PASSED"}
                    </Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Passing Score:</Text>
                    <Text style={styles.resultValue}>{selectedCourse?.passingPercentage}%</Text>
                  </View>
                </View>

                <Text style={styles.resultMessage}>
                  {result?.passed 
                    ? "🎉 Great job! You've successfully completed this course." 
                    : "📚 Keep learning! Review the material and try again to improve your score."}
                </Text>

                <TouchableOpacity style={styles.closeQuizButton} onPress={closeQuiz}>
                  <Text style={styles.closeQuizButtonText}>Back to Courses</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },
  header: {
    backgroundColor: "#0B2D4A",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  smallTitle: {
    color: "#F5A623",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
    marginTop: 6,
  },
  subtitle: {
    color: "#D8DDE5",
    marginTop: 6,
  },
  userName: {
    color: "#D96A17",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  progressCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -25,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  progressLabel: {
    color: "#777",
  },
  progressValue: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#0B2D4A",
  },
  circle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ff7b00",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 18,
    marginHorizontal: 4,
    borderRadius: 16,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff7b00",
  },
  statText: {
    marginTop: 5,
    color: "#666",
  },
  sectionTitle: {
    marginTop: 25,
    marginHorizontal: 20,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
  },
  courseCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  courseIcon: {
    marginRight: 15,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },
  courseSubtitle: {
    color: "#777",
    marginTop: 4,
    fontSize: 12,
  },
  courseMeta: {
    flexDirection: "row",
    marginTop: 6,
    gap: 12,
  },
  passingInfo: {
    color: "#ff7b00",
    fontSize: 11,
    fontWeight: "500",
  },
  questionCount: {
    color: "#666",
    fontSize: 11,
  },
  playButton: {
    backgroundColor: "#ff7b00",
    width: 45,
    height: 45,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  quizContainer: {
    flex: 1,
  },
  quizHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  closeButton: {
    padding: 4,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0B2D4A",
    flex: 1,
    textAlign: "center",
  },
  progressIndicator: {
    backgroundColor: "#ff7b0010",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ff7b00",
  },
  quizContent: {
    flex: 1,
    padding: 20,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  questionNumber: {
    fontSize: 12,
    color: "#ff7b00",
    fontWeight: "600",
    marginBottom: 10,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0B2D4A",
    lineHeight: 26,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionLetterText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
  },
  optionCardText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  correctOptionCard: {
    backgroundColor: "#E8F5E9",
    borderColor: "#2E7D32",
  },
  correctOptionCardText: {
    color: "#2E7D32",
    fontWeight: "500",
  },
  wrongOptionCard: {
    backgroundColor: "#FFEBEE",
    borderColor: "#C62828",
  },
  wrongOptionCardText: {
    color: "#C62828",
    fontWeight: "500",
  },
  nextButton: {
    backgroundColor: "#ff7b00",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F7F8FA",
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    elevation: 4,
  },
  resultIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFF4EC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0B2D4A",
    marginBottom: 20,
  },
  scoreCard: {
    backgroundColor: "#F7F8FA",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff7b00",
    marginBottom: 12,
  },
  scoreProgress: {
    width: "100%",
    height: 8,
    backgroundColor: "#E5E5E5",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  scoreProgressFill: {
    height: "100%",
    backgroundColor: "#ff7b00",
    borderRadius: 4,
  },
  scorePercentage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff7b00",
  },
  resultDetails: {
    width: "100%",
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: "#666",
  },
  resultValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  closeQuizButton: {
    backgroundColor: "#ff7b00",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
  },
  closeQuizButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});